using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace DesktopRug {
sealed class RugScene:Grid {
    internal readonly List<double> FrameTimes=new List<double>();
    internal readonly Cloth Cloth;
    readonly RugVisual visual;readonly FloorShadow shadow;readonly BroomPainter broom;readonly SweepFlights flights;
    readonly Action save;readonly Stopwatch clock=new Stopwatch();readonly TextBlock status;
    internal Action Menu,UndoSweep;internal Action<bool> BroomChanged;internal Action<Point,Point> Sweep;
    internal bool BroomMode;internal bool Persist=true;internal double AverageStepMs,MaxInputMs;
    bool dragging,moveWhole,rendering;Point last,pointer;int quietFrames;double lastTime;
    internal RugScene(RugState state,double width,double height,Action saveAction){
        Width=width;Height=height;ClipToBounds=true;save=saveAction;Cloth=new Cloth(state);
        shadow=new FloorShadow(Cloth);Children.Add(shadow);
        flights=new SweepFlights{IsHitTestVisible=false};Children.Add(flights);
        visual=new RugVisual(Cloth,width,height);Children.Add(visual);
        broom=new BroomPainter(width,height);Children.Add(broom);
        status=new TextBlock{Text="拖边缘掀开 · 拖中间移动 · 滚轮缩放",FontFamily=new FontFamily("Microsoft YaHei UI"),FontSize=13,Foreground=Brushes.White,Margin=new Thickness(14,9,14,9)};
        var hint=new Border{Child=status,Background=new SolidColorBrush(Color.FromArgb(225,58,45,33)),CornerRadius=new CornerRadius(9),HorizontalAlignment=HorizontalAlignment.Left,VerticalAlignment=VerticalAlignment.Bottom,Margin=new Thickness(20,0,0,19),IsHitTestVisible=false};Children.Add(hint);
        var panel=new StackPanel{Orientation=Orientation.Horizontal};AddButton(panel,"−",()=>Scale(.9),36);AddButton(panel,"＋",()=>Scale(1.1),36);AddButton(panel,"铺平",Flatten,54);AddButton(panel,"扫帚",ToggleBroom,54);AddButton(panel,"撤销清扫",()=>{if(UndoSweep!=null)UndoSweep();},84);
        Children.Add(new Border{Child=panel,Background=new SolidColorBrush(Color.FromArgb(245,247,240,222)),CornerRadius=new CornerRadius(12),Padding=new Thickness(7),HorizontalAlignment=HorizontalAlignment.Right,VerticalAlignment=VerticalAlignment.Bottom,Margin=new Thickness(0,0,20,16)});
        MouseLeftButtonDown+=Down;MouseMove+=Move;MouseLeftButtonUp+=Up;LostMouseCapture+=(s,e)=>{if(dragging)EndDrag();};
        MouseRightButtonUp+=(s,e)=>{if(BroomMode)ToggleBroom();else if(Menu!=null)Menu();e.Handled=true;};
        MouseWheel+=(s,e)=>{if(BroomMode)return;if((Keyboard.Modifiers&ModifierKeys.Shift)!=0)Cloth.Transform(1,e.Delta/120.0*5);else Scale(Math.Pow(1.07,e.Delta/120.0));Wake();Save();e.Handled=true;};
        UpdateMesh();
    }
    static void AddButton(Panel p,string text,Action action,double width){var b=new Button{Content=text,Width=width,Height=30,Margin=new Thickness(2,0,2,0),Background=Brushes.Transparent,BorderThickness=new Thickness(0),FontSize=14,FontFamily=new FontFamily("Microsoft YaHei UI"),Cursor=Cursors.Hand};b.Click+=(s,e)=>action();p.Children.Add(b);}
    internal void SetStatus(string text){status.Text=text;}
    internal bool HitSurface(Point p){return BroomMode||new Rect(Width-328,Height-60,308,44).Contains(p)||broom.RestRect.Contains(p)||Cloth.Contains(p);}
    internal void ToggleBroom(){
        if(dragging){EndDrag();ReleaseMouseCapture();}BroomMode=!BroomMode;
        if(BroomMode){Cloth.Snap();if(Cloth.State.Width<360)Cloth.Transform(360/Cloth.State.Width,0);UpdateMesh();SetStatus("地毯已铺开 · 正在准备扫帚…");}
        else SetStatus("拖边缘掀开 · 拖中间移动 · 滚轮缩放");
        Background=BroomMode?new SolidColorBrush(Color.FromArgb(1,0,0,0)):null;
        broom.Active=BroomMode;pointer=new Point(Width-76,Height-90);broom.Move(pointer);Cursor=BroomMode?Cursors.None:Cursors.Hand;
        if(BroomChanged!=null)BroomChanged(BroomMode);Wake();
    }
    void Down(object sender,MouseButtonEventArgs e){
        Point p=e.GetPosition(this);if(!BroomMode&&broom.RestRect.Contains(p)){ToggleBroom();e.Handled=true;return;}
        if(BroomMode){dragging=true;last=p;CaptureMouse();if(Sweep!=null)Sweep(p,p);e.Handled=true;return;}
        if(!Cloth.Contains(p))return;if(e.ClickCount==2){Flatten();e.Handled=true;return;}
        dragging=true;moveWhole=(Keyboard.Modifiers&ModifierKeys.Shift)!=0||!Cloth.IsEdge(p);last=p;if(!moveWhole)Cloth.BeginGrip(p);CaptureMouse();Wake();e.Handled=true;
    }
    void Move(object sender,MouseEventArgs e){
        var timer=Stopwatch.StartNew();Point p=e.GetPosition(this);
        if(BroomMode){pointer=p;if(dragging&&Sweep!=null)Sweep(last,p);last=p;Wake();}
        else if(!dragging)Cursor=Cloth.Contains(p)?Cursors.Hand:Cursors.Arrow;
        else {if(moveWhole)Cloth.TranslateInstant(p.X-last.X,p.Y-last.Y);else Cloth.MoveGrip(p);last=p;Wake();e.Handled=true;}
        MaxInputMs=Math.Max(MaxInputMs,timer.Elapsed.TotalMilliseconds);
    }
    void Up(object sender,MouseButtonEventArgs e){if(dragging){EndDrag();ReleaseMouseCapture();e.Handled=true;}}
    void EndDrag(){dragging=false;if(BroomMode)return;Cloth.EndGrip();Clamp();Wake();Save();}
    internal void Clamp(){double marginX=Math.Min(Width*.45,Cloth.State.Width*.35),marginY=Math.Min(Height*.45,Cloth.Height*.35);double dx=Math.Max(marginX,Math.Min(Width-marginX,Cloth.State.X))-Cloth.State.X,dy=Math.Max(marginY,Math.Min(Height-marginY,Cloth.State.Y))-Cloth.State.Y;if(Math.Abs(dx)+Math.Abs(dy)>.01)Cloth.TranslateInstant(dx,dy);}
    internal void Flatten(){Cloth.Snap();UpdateMesh();Wake();Save();}
    internal void Scale(double factor){if(BroomMode)return;double width=Math.Max(260,Math.Min(Math.Min(Width,Height)*1.6,Cloth.State.Width*factor));Cloth.Transform(width/Cloth.State.Width,0);Clamp();UpdateMesh();Wake();Save();}
    internal void Wake(){quietFrames=0;if(!rendering){rendering=true;lastTime=0;clock.Restart();CompositionTarget.Rendering+=Tick;}}
    void Tick(object sender,EventArgs e){
        double time=clock.Elapsed.TotalSeconds,dt=time-lastTime;if(dt<1.0/65)return;lastTime=time;
        if(Program.Profiling)FrameTimes.Add(dt*1000);var timer=Stopwatch.StartNew();double energy=0;
        if(!BroomMode){energy=Cloth.Step(dt);UpdateMesh();}
        else broom.Move(pointer);
        flights.Advance(dt);timer.Stop();AverageStepMs=AverageStepMs*.9+timer.Elapsed.TotalMilliseconds*.1;
        quietFrames=energy<.025?quietFrames+1:0;
        if(!dragging&&!flights.HasFlights&&quietFrames>3){Stop();if(!BroomMode)Save();}
    }
    internal void AddFlight(DesktopIcons.Item item,Point from,Point to){flights.Add(item,from,to);Wake();}
    internal void Save(){if(Persist)Cloth.SaveShape();save();}
    internal void UpdateMesh(){visual.Update();shadow.Update();}
    internal void Stop(){if(rendering){CompositionTarget.Rendering-=Tick;rendering=false;clock.Stop();}}
    internal void SetIcons(List<Rect> icons){Cloth.Icons=icons;Cloth.Rebuild();UpdateMesh();}
    internal void RenderPng(string path){Measure(new Size(Width,Height));Arrange(new Rect(0,0,Width,Height));UpdateLayout();var image=new RenderTargetBitmap((int)Width,(int)Height,96,96,PixelFormats.Pbgra32);image.Render(this);var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(image));using(var f=File.Create(path))encoder.Save(f);}
}
sealed class BroomPainter:FrameworkElement {
    readonly DrawingVisual sprite=new DrawingVisual();readonly TranslateTransform translate=new TranslateTransform();readonly double w,h;internal bool Active;
    internal Rect RestRect{get{return new Rect(w-140,h-208,120,149);}}
    internal BroomPainter(double width,double height){w=width;h=height;AddVisualChild(sprite);sprite.Transform=translate;
        using(var dc=sprite.RenderOpen()){
            dc.PushTransform(new RotateTransform(-27));
            dc.DrawLine(new Pen(new SolidColorBrush(Color.FromArgb(45,0,0,0)),10),new Point(4,-100),new Point(4,-12));
            dc.DrawLine(new Pen(new SolidColorBrush(Color.FromRgb(130,76,38)),7),new Point(0,-106),new Point(0,-13));dc.DrawLine(new Pen(new SolidColorBrush(Color.FromRgb(218,164,99)),2),new Point(-2,-106),new Point(-2,-15));
            var g=new StreamGeometry();using(var c=g.Open()){c.BeginFigure(new Point(-15,-23),true,true);c.LineTo(new Point(15,-23),true,false);c.LineTo(new Point(36,18),true,false);c.QuadraticBezierTo(new Point(0,28),new Point(-36,18),true,false);}g.Freeze();dc.DrawGeometry(new SolidColorBrush(Color.FromRgb(208,159,67)),new Pen(new SolidColorBrush(Color.FromRgb(135,90,30)),1),g);
            for(int x=-32;x<=32;x+=2)dc.DrawLine(new Pen(new SolidColorBrush(Color.FromRgb((byte)(162+x%3*6),115,42)),.8),new Point(x*.42,-17),new Point(x,19));dc.DrawLine(new Pen(new SolidColorBrush(Color.FromRgb(149,51,38)),5),new Point(-17,-16),new Point(17,-16));dc.Pop();
        }Move(new Point(w-76,h-90));
    }
    internal void Move(Point p){if(!Active)p=new Point(w-76,h-90);translate.X=p.X;translate.Y=p.Y;}
    protected override int VisualChildrenCount{get{return 1;}}
    protected override Visual GetVisualChild(int index){return sprite;}
}
sealed class SweepFlights:FrameworkElement {
    sealed class Flight{internal DesktopIcons.Item Item;internal Point From,To;internal double Time;}
    readonly List<Flight> flights=new List<Flight>();internal bool HasFlights{get{return flights.Count>0;}}
    internal void Add(DesktopIcons.Item item,Point from,Point to){flights.Add(new Flight{Item=item,From=from,To=to});InvalidateVisual();}
    internal void Advance(double dt){foreach(var f in flights)f.Time+=dt;flights.RemoveAll(f=>f.Time>.48);if(flights.Count>0||dt>0)InvalidateVisual();}
    protected override void OnRender(DrawingContext dc){foreach(var f in flights){double t=Math.Min(1,f.Time/.48),s=1-Math.Pow(1-t,3);Point p=f.From+(f.To-f.From)*s;p.Y-=Math.Sin(t*Math.PI)*18;
        dc.DrawEllipse(new SolidColorBrush(Color.FromArgb(35,0,0,0)),null,new Point(p.X+3,p.Y+21),19,5);
        if(f.Item.Image!=null)dc.DrawImage(f.Item.Image,new Rect(p.X-20,p.Y-20,40,40));else dc.DrawRoundedRectangle(Brushes.AntiqueWhite,new Pen(Brushes.SaddleBrown,1),new Rect(p.X-16,p.Y-20,32,40),3,3);
    }}
}
}

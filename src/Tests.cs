using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
namespace DesktopRug {
static class Tests {
    internal static void IconIntegration(){
        string file=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"DesktopRug-check-"+Guid.NewGuid().ToString("N")+".txt");
        File.WriteAllText(file,"Temporary integration-test item created by DesktopRug. No user file is touched.");
        try{using(var icons=new DesktopIcons()){
            DesktopIcons.Item item=null;for(int n=0;n<30&&item==null;n++){System.Threading.Thread.Sleep(100);item=icons.Read(1,1,0,0).FirstOrDefault(i=>string.Equals(i.Path,file,StringComparison.OrdinalIgnoreCase));}
            if(item==null)throw new Exception("Test icon not enumerated");var original=item.Position;string backup=Path.Combine(Program.Root,"qa","temporary-icon-layout.bin");icons.SaveLayout(backup,new List<DesktopIcons.Item>{item});
            try{
                var moved=new Native.POINT{X=original.X+17,Y=original.Y+11};icons.Move(new List<DesktopIcons.Item>{item},new List<Native.POINT>{moved});
                var observed=icons.Read(1,1,0,0).First(i=>i.Path==file);Check(observed.Position.X==moved.X&&observed.Position.Y==moved.Y,"native free-position move");
                icons.RestoreLayout(backup);observed=icons.Read(1,1,0,0).First(i=>i.Path==file);Check(observed.Position.X==original.X&&observed.Position.Y==original.Y,"native undo restores exact position");
                File.WriteAllText(Path.Combine(Program.Root,"qa","icon-integration.txt"),"PASS: temporary real desktop icon moved +17,+11 pixels without grid snapping.\nPASS: saved PIDL layout restored its exact original position.\nPASS: no user file was moved, renamed or deleted.\nWallpaper: "+FloorWallpaper.Current()+"\n");
            }finally{icons.Move(new List<DesktopIcons.Item>{item},new List<Native.POINT>{original});if(File.Exists(backup))File.Delete(backup);}
        }}finally{File.Delete(file);}
    }
    static int checks;
    static void Check(bool condition,string label){if(!condition)throw new Exception("FAIL: "+label);checks++;}
    internal static void Run(){
        string q=Path.Combine(Program.Root,"qa");Directory.CreateDirectory(q);checks=0;File.WriteAllText(Path.Combine(q,"tests-v3.txt"),"RUNNING");
        var state=new RugState{X=550,Y=335,Width=680,Angle=-4};var scene=new RugScene(state,1100,750,()=>{}){Persist=false};var c=scene.Cloth;
        scene.Background=new ImageBrush(new BitmapImage(new Uri(Path.Combine(Program.Root,"assets","wood-floor.png"))));
        for(int j=0;j<10;j++)for(int i=0;i<8;i++)c.Icons.Add(new Rect(i*75,j*70,55,60));c.Rebuild();scene.UpdateMesh();scene.RenderPng(Path.Combine(q,"v3-flat.png"));
        Check(c.Contains(new Point(550,335))&&!c.Contains(new Point(10,10)),"flat hit testing");
        double max=0;int intersections=0;var times=new List<double>();
        foreach(var grip in new[]{new Point(335,0),new Point(320,205),new Point(0,-220),new Point(-320,205)}){
            c.Snap();Point start=c.Screen(grip);c.BeginGrip(start);var direction=new Vector(-grip.X,-grip.Y);direction.Normalize();
            for(int f=0;f<90;f++){c.MoveGrip(start+direction*(Math.Min(1,f/60.0)*280));var sw=Stopwatch.StartNew();c.Step();scene.UpdateMesh();times.Add(sw.Elapsed.TotalMilliseconds);max=Math.Max(max,c.MaximumStretch());}
            c.EndGrip();for(int f=0;f<30;f++)c.Step();int collisions=Validation.Intersections(c);intersections+=collisions;Check(collisions==0,"no triangle intersections for grip "+grip);
            Check(c.Points.All(p=>!double.IsNaN(p.X)&&p.Z>=Cloth.HalfThickness),"finite geometry above floor");
            scene.UpdateMesh();scene.RenderPng(Path.Combine(q,grip.X==335?"v3-side-fold.png":grip.X==320?"v3-corner-fold.png":grip.X==0?"v3-top-fold.png":"v3-left-fold.png"));
            var points=c.Points.ToArray();for(int f=0;f<10;f++)c.Step();Check(c.Points.Select((p,i)=>(p-points[i]).Length).Max()<.001,"released fold does not drift");
        }
        Check(max<1.08,"material length stays within 8% with 80 icon bumps; actual "+max);
        c.Snap();c.BeginGrip(c.Screen(new Point(335,0)));for(int i=0;i<180;i++){c.MoveGrip(new Point(i%2==0?-10000:10000,335));c.Step();}c.EndGrip();Check(Validation.Intersections(c)==0,"rapid alternating extreme drags");
        c.Snap();var p0=c.Points[100];c.TranslateInstant(23,41);Check((c.Points[100]-p0-new System.Windows.Media.Media3D.Vector3D(23,-41,0)).Length<.001,"translation exact");double old=state.Width;c.Transform(1.2,15);Check(Math.Abs(state.Width-old*1.2)<.001,"zoom updates size");
        Check(Sweeper.DistanceToStroke(new Point(40,10),new Point(0,0),new Point(80,0))==10,"broom segment hit");
        times.Sort();scene.Stop();File.WriteAllText(Path.Combine(q,"tests-v3.txt"),"PASS: "+checks+" substantive checks\nTriangle intersections across four fold directions: "+intersections+"\n80 desktop obstacles; simulation + mesh + shadow update median: "+times[times.Count/2].ToString("F2")+" ms; p95: "+times[(int)(times.Count*.95)].ToString("F2")+" ms\nMaximum material stretch: "+max.ToString("F4")+"\nThese are CPU update timings, not measured desktop FPS.\n");
    }
    internal static void SweepIntegration(){
        string file=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"DesktopRug-sweep-check-"+Guid.NewGuid().ToString("N")+".txt"),backup=Path.Combine(Program.Root,"qa","sweep-test-layout.bin");
        File.WriteAllText(file,"Temporary DesktopRug sweep integration item.");
        DesktopIcons.Item item=null;Native.POINT original=new Native.POINT();bool got=false;Sweeper sweeper=null;
        try{using(var desktop=new DesktopIcons()){
            for(int i=0;i<40&&item==null;i++){Thread.Sleep(100);item=desktop.Read(1.25,1.25,0,0).FirstOrDefault(x=>x.Path==file);}if(item==null)throw new Exception("Missing temporary desktop icon");original=item.Position;got=true;
            desktop.Move(new List<DesktopIcons.Item>{item},new List<Native.POINT>{new Native.POINT{X=1550,Y=100}});
            var scene=new RugScene(new RugState{X=970,Y=500,Width=600},1536,816,()=>{}){Persist=false};sweeper=new Sweeper(scene,1.25,1.25,0,0,()=>{},backup){OnlyPath=file};
            var timer=Stopwatch.StartNew();scene.ToggleBroom();double activateMs=timer.Elapsed.TotalMilliseconds;Validation.PumpUntil(()=>sweeper.Ready,15000);
            var before=desktop.Read(1.25,1.25,0,0).First(x=>x.Path==file);Point center=before.Center;
            timer.Restart();for(int i=0;i<5000;i++)sweeper.Sweep(center+new Vector(-60,-10),center+new Vector(60,10));double dispatchMs=timer.Elapsed.TotalMilliseconds;
            Validation.PumpUntil(()=>sweeper.Completed==1,15000);var moved=desktop.Read(1.25,1.25,0,0).First(x=>x.Path==file);Check(scene.Cloth.Contains(moved.Center),"real sweep moved test icon beneath rug");Check(moved.Position.X!=before.Position.X,"real icon coordinates changed");
            sweeper.Undo();Validation.PumpUntil(()=>sweeper.Ready&&sweeper.Completed==0,15000);var undone=desktop.Read(1.25,1.25,0,0).First(x=>x.Path==file);Check(undone.Position.X==before.Position.X&&undone.Position.Y==before.Position.Y,"sweep undo exact");scene.Stop();
            File.WriteAllText(Path.Combine(Program.Root,"qa","sweep-v3.txt"),"PASS: actual Sweeper path moved only its own temporary desktop file icon under the rug.\nPASS: undo restored exact starting coordinates.\nToggleBroom returned in "+activateMs.ToString("F2")+" ms.\n5000 hit requests: "+dispatchMs.ToString("F2")+" ms total.\nLongest hit handler: "+sweeper.MaxSweepMs.ToString("F3")+" ms.\nCOM enumeration / image retrieval / moves ran on the background STA worker.\n");
        }}finally{if(sweeper!=null)sweeper.Dispose();if(got)using(var desktop=new DesktopIcons())desktop.Move(new List<DesktopIcons.Item>{item},new List<Native.POINT>{original});if(File.Exists(file))File.Delete(file);if(File.Exists(backup))File.Delete(backup);}
    }
    internal static void Preview(){
        var app=new Application();var scene=new RugScene(new RugState{X=560,Y=330,Width=650,Angle=-4},1100,750,()=>{}){Persist=false};
        scene.Background=new ImageBrush(new BitmapImage(new Uri(Path.Combine(Program.Root,"assets","wood-floor.png"))));
        var window=new Window{Title="桌面地毯 · 交互验证",Content=scene,SizeToContent=SizeToContent.WidthAndHeight,ResizeMode=ResizeMode.NoResize,WindowStartupLocation=WindowStartupLocation.CenterScreen};
        scene.BroomChanged=active=>{scene.Background=new ImageBrush(new BitmapImage(new Uri(Path.Combine(Program.Root,"assets","wood-floor.png"))));if(active)scene.SetStatus("测试窗口：扫帚跟手检查 · 不移动真实文件");};
        window.Closed+=(s,e)=>{scene.Stop();File.WriteAllText(Path.Combine(Program.Root,"qa","ui-v3.txt"),"Mean active update: "+scene.AverageStepMs.ToString("F3")+" ms\nMax mouse handler: "+scene.MaxInputMs.ToString("F3")+" ms\n");};app.Run(window);
    }
}
}

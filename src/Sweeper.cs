using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Windows;
using System.Windows.Threading;
namespace DesktopRug {
sealed class Sweeper:IDisposable {
    readonly RugScene scene;readonly double sx,sy;readonly int ox,oy;readonly Action refresh;readonly string backup;
    readonly BlockingCollection<Action<DesktopIcons>> jobs=new BlockingCollection<Action<DesktopIcons>>();
    readonly Thread worker;readonly DispatcherTimer batch;readonly Dispatcher ui;
    List<DesktopIcons.Item> icons=new List<DesktopIcons.Item>();
    readonly HashSet<DesktopIcons.Item> swept=new HashSet<DesktopIcons.Item>();
    readonly List<DesktopIcons.Item> pending=new List<DesktopIcons.Item>();
    bool backedUp,disposed;int generation;internal bool Ready;internal int Completed;internal double MaxSweepMs;
    internal string OnlyPath; // Integration tests may restrict hits to their own temporary file.
    internal Sweeper(RugScene rug,double scaleX,double scaleY,int offsetX,int offsetY,Action onRefresh,string backupPath=null){
        scene=rug;sx=scaleX;sy=scaleY;ox=offsetX;oy=offsetY;refresh=onRefresh;ui=scene.Dispatcher;backup=backupPath??Path.Combine(Program.Root,"before-last-sweep.bin");
        batch=new DispatcherTimer{Interval=TimeSpan.FromMilliseconds(50)};batch.Tick+=(s,e)=>Flush();
        scene.BroomChanged=SetActive;scene.Sweep=Sweep;scene.UndoSweep=Undo;
        worker=new Thread(Work){IsBackground=true,Name="DesktopRug shell worker"};worker.SetApartmentState(ApartmentState.STA);worker.Start();
    }
    void Work(){
        DesktopIcons desktop=null;
        try{foreach(var job in jobs.GetConsumingEnumerable()){try{if(desktop==null)desktop=new DesktopIcons();job(desktop);}catch(Exception ex){Program.Log("Sweep worker: "+ex);Post(()=>{Ready=false;scene.SetStatus("清扫未完成："+ex.Message+" · 可撤销清扫");});if(desktop!=null){desktop.Dispose();desktop=null;}}}}
        finally{if(desktop!=null)desktop.Dispose();}
    }
    void Queue(Action<DesktopIcons> action){if(!disposed)jobs.Add(action);}
    void Post(Action action){if(!disposed)ui.BeginInvoke((Action)(()=>{if(!disposed)action();}));}
    internal void SetActive(bool active){
        Flush();int version=++generation;Ready=false;if(!active)return;
        Completed=0;swept.Clear();
        Queue(desktop=>{
            desktop.EnableFreePlacement();var read=desktop.Read(sx,sy,ox,oy);backedUp=false;
            Post(()=>{if(version!=generation)return;icons=read;Ready=true;scene.SetStatus("按住左键扫过文件 · 已扫入 0 个 · 右键放下");});
        });
    }
    internal static double DistanceToStroke(Point p,Point a,Point b){Vector ab=b-a;double t=ab.LengthSquared<.001?0:Math.Max(0,Math.Min(1,Vector.Multiply(p-a,ab)/ab.LengthSquared));return (p-(a+ab*t)).Length;}
    internal void Sweep(Point from,Point to){
        var clock=Stopwatch.StartNew();if(!Ready)return;
        foreach(var item in icons){
            if(!item.Sweepable||swept.Contains(item)||(OnlyPath!=null&&!string.Equals(item.Path,OnlyPath,StringComparison.OrdinalIgnoreCase)))continue;
            // The inexpensive segment test must precede any cloth/target work.
            if(DistanceToStroke(item.Center,from,to)>49||scene.Cloth.Contains(item.Center))continue;
            pending.Add(item);swept.Add(item);
        }
        if(pending.Count>0)batch.Start();MaxSweepMs=Math.Max(MaxSweepMs,clock.Elapsed.TotalMilliseconds);
    }
    void Flush(){
        batch.Stop();if(pending.Count==0)return;
        var selected=new List<DesktopIcons.Item>(pending);pending.Clear();var all=OnlyPath==null?icons:icons.Where(i=>string.Equals(i.Path,OnlyPath,StringComparison.OrdinalIgnoreCase)).ToList();
        var starts=selected.Select(i=>i.Center).ToArray();var targets=new List<Point>();var positions=new List<Native.POINT>();
        for(int i=0;i<selected.Count;i++){
            Point target=scene.Cloth.Screen(new Point((i%3-1)*10,(i/3%3-1)*8));targets.Add(target);
            positions.Add(new Native.POINT{X=(int)Math.Round((target.X-24)*sx+ox),Y=(int)Math.Round((target.Y-24)*sy+oy)});
        }
        Queue(desktop=>{
            if(!backedUp){desktop.SaveLayout(backup,all);backedUp=true;}
            foreach(var item in selected)desktop.LoadImage(item);
            desktop.Move(selected,positions);
            Post(()=>{for(int i=0;i<selected.Count;i++){scene.AddFlight(selected[i],starts[i],targets[i]);selected[i].Center=targets[i];}Completed+=selected.Count;if(scene.BroomMode)scene.SetStatus("已扫入 "+Completed+" 个 · 右键放下 · 掀开地毯可找回");refresh();});
        });
    }
    internal void Undo(){
        Flush();Ready=false;scene.SetStatus("正在恢复清扫前的位置…");
        Queue(desktop=>{
            if(!File.Exists(backup)){Post(()=>{Ready=scene.BroomMode;scene.SetStatus("还没有清扫记录");});return;}
            desktop.RestoreLayout(backup);var read=desktop.Read(sx,sy,ox,oy);backedUp=false;
            Post(()=>{icons=read;swept.Clear();Completed=0;Ready=scene.BroomMode;scene.SetStatus("已恢复清扫前的位置"+(scene.BroomMode?" · 可继续清扫":""));refresh();});
        });
    }
    public void Dispose(){if(disposed)return;Flush();disposed=true;batch.Stop();jobs.CompleteAdding();}
}
}

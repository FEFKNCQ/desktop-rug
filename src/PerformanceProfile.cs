using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Media;
using System.Windows.Threading;
namespace DesktopRug {
static class PerformanceProfile {
    internal static void Run(RugScene scene,Application app){
        scene.Persist=false;scene.Cloth.Snap();var p=scene.Cloth.Points.Last();Point start=new Point(p.X,-p.Y);scene.Cloth.BeginGrip(start);
        var clock=Stopwatch.StartNew();var timer=new DispatcherTimer{Interval=TimeSpan.FromMilliseconds(16)};
        timer.Tick+=(s,e)=>{double time=clock.Elapsed.TotalSeconds;scene.Cloth.MoveGrip(start+new Vector(-180*(.5-.5*Math.Cos(time*2)),-100*(.5-.5*Math.Cos(time*2))));scene.Wake();if(time<10)return;timer.Stop();var values=scene.FrameTimes.Skip(3).OrderBy(x=>x).ToArray();Directory.CreateDirectory(Path.Combine(Program.Root,"qa"));File.WriteAllText(Path.Combine(Program.Root,"qa","wpf-profile.txt"),"Actual desktop child window animation callbacks\nRenderTier="+(RenderCapability.Tier>>16)+"\nFrames="+values.Length+"\nElapsedSeconds="+time.ToString("F2")+"\nMedianMs="+values[values.Length/2].ToString("F2")+"\nP95Ms="+values[(int)(values.Length*.95)].ToString("F2")+"\nCpuUpdateMs="+scene.AverageStepMs.ToString("F2")+"\n");scene.Cloth.Snap();app.Shutdown();};timer.Start();
    }
}
}

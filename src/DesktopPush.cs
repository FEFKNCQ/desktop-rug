using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;

namespace DesktopRug {
static partial class DesktopBridge {
    static IntPtr iconView=IntPtr.Zero;static bool iconViewCovered;
    static readonly Dictionary<string,DesktopIcons.Item> liveDirty=new Dictionary<string,DesktopIcons.Item>();
    static void PersistLive(){if(liveDirty.Count==0)return;var pending=liveDirty.Values.ToList();Desktop().Move(pending,pending.Select(i=>i.Position).ToList());liveDirty.Clear();}
    static readonly string PushMarker=Path.Combine(Program.Root,"push-active.txt");
    static IntPtr IconView(){return Native.FindWindowEx(Native.DesktopView(),IntPtr.Zero,"SysListView32",null);}
    static void RecoverIconView(){
        if(!File.Exists(PushMarker))return;int pid;bool alive=false;
        if(int.TryParse(File.ReadAllText(PushMarker),out pid))try{var process=Process.GetProcessById(pid);alive=!process.HasExited&&process.ProcessName=="DesktopRug";}catch{}
        if(!alive){var view=IconView();if(view!=IntPtr.Zero)Native.ShowWindow(view,8);File.Delete(PushMarker);}
    }
    static void RevealIconView(){
        if(!iconViewCovered)return;
        var view=Native.IsWindow(iconView)?iconView:IconView();if(view!=IntPtr.Zero)Native.ShowWindow(view,8);
        iconViewCovered=false;if(File.Exists(PushMarker))File.Delete(PushMarker);
    }
    static object BeginPush(){
        RevealIconView();Desktop().EnableFreePlacement();backedUp=false;backup=Path.Combine(Program.Root,"before-last-sweep.bin");ReadIcons();
        return icons.Select(i=>new{id=Convert.ToBase64String(i.Id),x=i.Center.X,y=i.Center.Y,sweepable=i.Sweepable,name=i.Name}).ToArray();
    }
    static object CommitPush(Dictionary<string,object> args){
        if(icons==null)ReadIcons();
        var requests=((System.Collections.IEnumerable)args["positions"]).Cast<object>().Select(o=>(Dictionary<string,object>)o).ToList();
        var selected=new List<DesktopIcons.Item>();var points=new List<Native.POINT>();var moved=new List<object>();
        var lookup=icons.ToDictionary(i=>Convert.ToBase64String(i.Id));
        foreach(var request in requests){DesktopIcons.Item item;string id=(string)request["id"];if(!lookup.TryGetValue(id,out item)||!item.Sweepable)continue;double x=Number(request,"x"),y=Number(request,"y");if(Math.Abs(x)>15000||Math.Abs(y)>15000)throw new ArgumentException("图标坐标超出范围");var point=new Native.POINT{X=(int)Math.Round((x-24)*scale+ox),Y=(int)Math.Round((y-24)*scale+oy)};if(!(args.ContainsKey("persist")&&(bool)args["persist"])&&point.X==item.Position.X&&point.Y==item.Position.Y)continue;selected.Add(item);points.Add(point);moved.Add(new{id=id,x=x,y=y});}
        bool test=args.ContainsKey("test")&&(bool)args["test"];
        if(test&&selected.Any(i=>!Path.GetFileName(i.Path).StartsWith("DesktopRug-gpu-check-")))throw new InvalidOperationException("Test is restricted to its own files");
        if(test)backup=Path.Combine(Program.Root,"qa","gpu-test-layout.bin");
        if(selected.Count>0){if(!backedUp){Desktop().SaveLayout(backup,test?selected:icons);backedUp=true;}bool live=args.ContainsKey("live")&&(bool)args["live"];if(live)Desktop().MoveLive(selected,points);else Desktop().Move(selected,points);for(int n=0;n<selected.Count;n++){selected[n].Center=new System.Windows.Point((points[n].X-ox)/scale+24,(points[n].Y-oy)/scale+24);string key=Convert.ToBase64String(selected[n].Id);if(live)liveDirty[key]=selected[n];else liveDirty.Remove(key);}}
        return moved;
    }
}
}

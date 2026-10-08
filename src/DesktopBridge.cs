using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Media.Imaging;
using Forms=System.Windows.Forms;
namespace DesktopRug {
static partial class DesktopBridge {
    static readonly JavaScriptSerializer json=new JavaScriptSerializer{MaxJsonLength=2000000};
    static readonly object output=new object();static DesktopIcons desktop;static List<DesktopIcons.Item> icons;static bool backedUp;
    static double scale=1.25;static int ox,oy;static string backup;static IntPtr surface,desktopOwner;
    static readonly Dictionary<string,string> images=new Dictionary<string,string>();
    [DllImport("user32.dll")]static extern IntPtr SetParent(IntPtr child,IntPtr parent);
    [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")]static extern IntPtr GetStyle(IntPtr h,int index);
    [DllImport("user32.dll",EntryPoint="SetWindowLongPtrW")]static extern IntPtr SetStyle(IntPtr h,int index,IntPtr value);
    [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
    [DllImport("user32.dll")]static extern IntPtr GetAncestor(IntPtr h,uint flags);
    [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")]static extern IntPtr GetWindow(IntPtr h,uint relation);
    static void Send(object value){lock(output){Console.WriteLine(json.Serialize(value));Console.Out.Flush();}}
    internal static void Run(){
        Console.SetIn(new StreamReader(Console.OpenStandardInput(),new System.Text.UTF8Encoding(false)));Console.SetOut(new StreamWriter(Console.OpenStandardOutput(),new System.Text.UTF8Encoding(false)){AutoFlush=true});
        RecoverIconView();try{using(var quit=new EventWaitHandle(false,EventResetMode.AutoReset,"Local\\DesktopRug.Quit"))using(var toggle=new EventWaitHandle(false,EventResetMode.AutoReset,"Local\\DesktopRug.Toggle")){
            var qw=ThreadPool.RegisterWaitForSingleObject(quit,(s,t)=>Send(new{evt="quit"}),null,-1,false);var tw=ThreadPool.RegisterWaitForSingleObject(toggle,(s,t)=>Send(new{evt="toggle"}),null,-1,false);
            string line;while((line=Console.ReadLine())!=null){object id=null;try{var request=json.Deserialize<Dictionary<string,object>>(line);id=request["id"];var args=request.ContainsKey("args")?request["args"] as Dictionary<string,object>:new Dictionary<string,object>();Send(new{id=id,result=Call((string)request["method"],args)});}catch(Exception ex){Program.Log("Bridge: "+ex.Message);Send(new{id=id,error=ex.Message});}}
            qw.Unregister(null);tw.Unregister(null);
        }}finally{try{PersistLive();}catch(Exception ex){Program.Log("Persist live icons: "+ex.Message);}if(desktop!=null)desktop.Dispose();RevealIconView();}
    }
    static double Number(Dictionary<string,object> args,string key,double fallback=0){object o;if(!args.TryGetValue(key,out o))return fallback;double v=Convert.ToDouble(o);if(double.IsNaN(v)||double.IsInfinity(v))throw new ArgumentException("Invalid number");return v;}
    static DesktopIcons Desktop(){if(desktop==null)desktop=new DesktopIcons();return desktop;}
    static object ReadIcons(){icons=Desktop().Read(scale,scale,ox,oy);return icons.Select(i=>new{id=Convert.ToBase64String(i.Id),x=i.Center.X,y=i.Center.Y,sweepable=i.Sweepable,name=i.Name}).ToArray();}
    static string Image(DesktopIcons.Item item){string id=Convert.ToBase64String(item.Id),image;if(images.TryGetValue(id,out image))return image;Desktop().LoadImage(item);if(item.Image==null)return null;var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create((BitmapSource)item.Image));using(var stream=new MemoryStream()){encoder.Save(stream);image="data:image/png;base64,"+Convert.ToBase64String(stream.ToArray());}images[id]=image;return image;}
    static object Call(string method,Dictionary<string,object> args){
        if(method=="organizeInfo")return OrganizeInfo();
        if(method=="organize")return Organize(args);
        if(method=="pushStats")return Desktop().LiveStats();
        if(method=="beginPush")return BeginPush();
        
        if(method=="commitPush")return CommitPush(args);
        if(method=="endPush"){args["persist"]=true;args["live"]=false;try{if(args.ContainsKey("positions"))CommitPush(args);PersistLive();}finally{RevealIconView();}return ReadIcons();}
        if(method=="revealIcons"){RevealIconView();return true;}
        if(method=="init"){
            scale=Number(args,"scale",1.25);var state=new RugState();state.Load();return new{x=state.X,y=state.Y,width=state.Width,angle=state.Angle,wallpaper=FloorWallpaper.Selected(),wallpapers=FloorWallpaper.Styles(),rugStyle=SurfaceStyles.Selected(),rugStyles=SurfaceStyles.Styles(),shape=File.Exists(Path.Combine(Program.Root,"plush-shape.json"))?File.ReadAllText(Path.Combine(Program.Root,"plush-shape.json")):null};
        }
        if(method=="attach"){
            var handle=new IntPtr(long.Parse((string)args["handle"]));uint pid;GetWindowThreadProcessId(handle,out pid);string executable=Process.GetProcessById((int)pid).MainModule.FileName;
            if(!Path.GetFullPath(executable).StartsWith(Path.Combine(Program.Root,"web"),StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Unexpected window owner");
            var parent=Native.DesktopView();if(parent==IntPtr.Zero)throw new InvalidOperationException("Windows 桌面尚未就绪");var work=Forms.Screen.PrimaryScreen.WorkingArea;var pos=new Native.POINT{X=work.Left,Y=work.Top};Native.ScreenToClient(parent,ref pos);ox=pos.X;oy=pos.Y;
            // Chromium's composited transparent HWND must remain a top-level
            // window. Making it a sibling of SysListView32 clips Explorer's
            // icon surface whenever mouse pass-through is disabled.
            surface=handle;desktopOwner=GetAncestor(parent,2);
            if(desktopOwner==IntPtr.Zero)throw new InvalidOperationException("找不到桌面所有者");
            SetStyle(handle,-8,desktopOwner);
            SetStyle(handle,-20,new IntPtr(GetStyle(handle,-20).ToInt64()|Native.WS_EX_NOACTIVATE|Native.WS_EX_TOOLWINDOW));
            Native.SetWindowPos(handle,new IntPtr(1),work.Left,work.Top,work.Width,work.Height,0x0010|0x0020|0x0200);
            bool attached=GetStyle(handle,-8)==desktopOwner&&(GetStyle(handle,-16).ToInt64()&Native.WS_CHILD)==0;if(!attached)throw new InvalidOperationException("桌面图层设置失败");
            if(!File.Exists(Path.Combine(Program.Root,"floor-enabled.txt"))){var initial=Desktop().Read(scale,scale,ox,oy);string layout=Path.Combine(Program.Root,"original-icon-layout.bin");if(!File.Exists(layout))Desktop().SaveLayout(layout,initial);Desktop().EnableFreePlacement();FloorWallpaper.ApplyWood();}
            File.WriteAllText(Path.Combine(Program.Root,"status.txt"),"Version=4.6\nRenderer=WebGL\nRunning=True\nAttached=True\nLayer=OwnedTopLevel\nChildWindow=False\nDisplay="+work.Width+"x"+work.Height+"\n");return new{attached=true};
        }
        if(method=="present"){if(surface==IntPtr.Zero)throw new InvalidOperationException("桌面图层尚未准备好");Native.SetWindowPos(surface,new IntPtr(1),0,0,0,0,0x0001|0x0002|0x0010|0x0040|0x0200);return true;}
        if(method=="layerInfo"){bool above=false;IntPtr next=surface;for(int n=0;n<1000&&next!=IntPtr.Zero;n++){next=GetWindow(next,2);if(next==desktopOwner){above=true;break;}}return new{isChild=(GetStyle(surface,-16).ToInt64()&Native.WS_CHILD)!=0,hasDesktopOwner=GetStyle(surface,-8)==desktopOwner,visible=IsWindowVisible(surface),aboveDesktop=above,desktopViewVisible=IsWindowVisible(Native.DesktopView()),nativeIconsVisible=IsWindowVisible(IconView()),iconViewCovered=iconViewCovered};}
        if(method=="icons")return ReadIcons();
        if(method=="iconImages"){if(icons==null)ReadIcons();var ids=((System.Collections.IEnumerable)args["ids"]).Cast<object>().Select(o=>(string)o).Take(4).ToArray();return icons.Where(i=>ids.Contains(Convert.ToBase64String(i.Id))).Select(i=>new{id=Convert.ToBase64String(i.Id),image=Image(i)}).ToArray();}
        if(method=="beginSweep"){Desktop().EnableFreePlacement();backedUp=false;backup=Path.Combine(Program.Root,"before-last-sweep.bin");return ReadIcons();}
        if(method=="sweep"){
            if(icons==null)ReadIcons();var ids=((System.Collections.IEnumerable)args["ids"]).Cast<object>().Select(o=>(string)o).ToArray();var selected=icons.Where(i=>i.Sweepable&&ids.Contains(Convert.ToBase64String(i.Id))).ToList();double x=Number(args,"x"),y=Number(args,"y");
            bool test=args.ContainsKey("test")&&(bool)args["test"];if(test&&selected.Any(i=>!Path.GetFileName(i.Path).StartsWith("DesktopRug-gpu-check-")))throw new InvalidOperationException("Test is restricted to its own files");
            if(test)backup=Path.Combine(Program.Root,"qa","gpu-test-layout.bin");if(!backedUp){Desktop().SaveLayout(backup??Path.Combine(Program.Root,"before-last-sweep.bin"),test?selected:icons);backedUp=true;}
            var result=new List<object>();var points=new List<Native.POINT>();int n=0;
            foreach(var item in selected){double tx=x+(n%3-1)*9,ty=y+(n/3%3-1)*7;points.Add(new Native.POINT{X=(int)Math.Round((tx-24)*scale+ox),Y=(int)Math.Round((ty-24)*scale+oy)});result.Add(new{id=Convert.ToBase64String(item.Id),fromX=item.Center.X,fromY=item.Center.Y,x=tx,y=ty,image=Image(item)});n++;}
            Desktop().Move(selected,points);return result;
        }
        if(method=="undo"){liveDirty.Clear();string file=backup??Path.Combine(Program.Root,"before-last-sweep.bin");if(File.Exists(file))Desktop().RestoreLayout(file);backedUp=false;return ReadIcons();}
        if(method=="save"){
            var state=new RugState();state.Load();state.X=Number(args,"x",state.X);state.Y=Number(args,"y",state.Y);state.Width=Math.Max(280,Math.Min(1600,Number(args,"width",state.Width)));state.Angle=Number(args,"angle",state.Angle);state.Save();if(args.ContainsKey("shape"))File.WriteAllText(Path.Combine(Program.Root,"plush-shape.json"),json.Serialize(args["shape"]));return true;
        }
        if(method=="wood"){FloorWallpaper.ApplyWood();return true;}if(method=="restoreWallpaper"){FloorWallpaper.Restore();return true;}
        if(method=="wallpaperInfo")return FloorWallpaper.Info();
        if(method=="chooseOriginalWallpaper")return FloorWallpaper.ChooseOriginal();
        if(method=="recoverOriginalWallpaper")return FloorWallpaper.RecoverOriginal(Convert.ToString(args["source"]));
        if(method=="setRugStyle")return SurfaceStyles.Select(Convert.ToString(args["style"]));
        if(method=="backupShape"){
            string directory=Path.Combine(Program.Root,"revisions","recovered-shapes",DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fffffff"));Directory.CreateDirectory(directory);
            foreach(string name in new[]{"plush-shape.json","state.ini","rug-style.txt"}){string source=Path.Combine(Program.Root,name);if(File.Exists(source))File.Copy(source,Path.Combine(directory,name));}return true;
        }
        if(method=="setWallpaper"){FloorWallpaper.ApplyStyle(Convert.ToString(args["style"]));return FloorWallpaper.Info();}
        if(method=="restoreIcons"){liveDirty.Clear();Desktop().RestoreOriginal();return ReadIcons();}
        throw new ArgumentException("Unknown bridge command");
    }
}
}

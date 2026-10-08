using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Media.Media3D;
using System.Windows.Threading;
using Forms = System.Windows.Forms;

namespace DesktopRug {
static class Program {
    internal static bool Profiling;
    internal static readonly string Root = AppDomain.CurrentDomain.BaseDirectory;
    internal static void Log(string s) { try { File.AppendAllText(Path.Combine(Root,"runtime.log"),DateTime.Now.ToString("s")+" "+s+Environment.NewLine); } catch {} }
    [STAThread] static void Main(string[] args) {
        if (args.Contains("--exit") || args.Contains("--toggle")) {
            try { using(var e=EventWaitHandle.OpenExisting(args.Contains("--exit")?"Local\\DesktopRug.Quit":"Local\\DesktopRug.Toggle")) e.Set(); } catch(WaitHandleCannotBeOpenedException) {}
            return;
        }
        try {
            if(args.Contains("--bridge")){DesktopBridge.Run();return;}
            if((args.Length==0||args.Contains("--gpu-preview")||args.Contains("--gpu-benchmark"))&&File.Exists(Path.Combine(Root,"web","enabled.flag"))){System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo{FileName=Path.Combine(Root,"web","node_modules","electron","dist","electron.exe"),Arguments="\""+Path.Combine(Root,"web")+"\""+(args.Contains("--gpu-preview")?" --preview":"")+(args.Contains("--gpu-benchmark")?" --benchmark":""),UseShellExecute=false,CreateNoWindow=true,WindowStyle=System.Diagnostics.ProcessWindowStyle.Hidden});return;}
            Profiling=args.Contains("--profile");
            if(args.Contains("--self-test")) { Tests.Run(); return; }
            if(args.Contains("--preview")) { Tests.Preview(); return; }
            if(args.Contains("--sweep-self-test")) {Tests.SweepIntegration();return;}
            if(args.Contains("--icon-self-test")) {Tests.IconIntegration();return;}
            if(args.Contains("--desktop-status")) { using(var icons=new DesktopIcons()){var list=icons.Read(1,1,0,0);File.WriteAllText(Path.Combine(Root,"qa","desktop-api.txt"),"Flags="+icons.Flags+"\nItems="+list.Count+"\nSweepable="+list.Count(i=>i.Sweepable)+"\n");}return; }
            if(args.Contains("--setup-desktop")) { using(var icons=new DesktopIcons()){var list=icons.Read(1,1,0,0);string backup=Path.Combine(Root,"original-icon-layout.bin");if(!File.Exists(backup))icons.SaveLayout(backup,list);icons.EnableFreePlacement();File.WriteAllText(Path.Combine(Root,"qa","desktop-setup.txt"),"AutoArrange="+((icons.Flags&1)!=0)+"\nSnapToGrid="+((icons.Flags&4)!=0)+"\nItems="+list.Count+"\n");}FloorWallpaper.ApplyWood();return; }
            bool created;
            using(var mutex=new Mutex(true,"Local\\DesktopRug.Instance",out created)) {
                if(!created) { using(var e=EventWaitHandle.OpenExisting("Local\\DesktopRug.Toggle")) e.Set(); return; }
                var app=new Application { ShutdownMode=ShutdownMode.OnExplicitShutdown };
                app.DispatcherUnhandledException+=(s,e)=> { Log(e.Exception.ToString()); e.Handled=true; app.Shutdown(1); };
                using(var host=new RugHost(app)) { host.Start(); app.Run(); }
            }
        } catch(Exception ex) { Log(ex.ToString()); if(!args.Any(a=>a.Contains("test"))) MessageBox.Show("地毯启动失败。详情已保存到程序目录的 runtime.log。\n\n"+ex.Message,"桌面地毯"); Environment.ExitCode=1; }
    }
}

static class Native {
    internal const int WS_CHILD=0x40000000, WS_VISIBLE=0x10000000, WS_CLIPSIBLINGS=0x04000000;
    internal const int WS_EX_TOOLWINDOW=0x80, WS_EX_NOACTIVATE=0x08000000;
    internal delegate bool EnumProc(IntPtr hwnd,IntPtr param);
    [StructLayout(LayoutKind.Sequential)] internal struct RECT { public int Left,Top,Right,Bottom; }
    [StructLayout(LayoutKind.Sequential)] internal struct POINT { public int X,Y; }
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] internal static extern IntPtr FindWindow(string cls,string title);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] internal static extern IntPtr FindWindowEx(IntPtr p,IntPtr after,string cls,string title);
    [DllImport("user32.dll")] internal static extern bool EnumWindows(EnumProc fn,IntPtr param);
    [DllImport("user32.dll")] internal static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll")] internal static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] internal static extern IntPtr GetParent(IntPtr hwnd);
    [DllImport("user32.dll")] internal static extern bool GetWindowRect(IntPtr hwnd,out RECT rect);
    [DllImport("user32.dll")] internal static extern bool GetClientRect(IntPtr hwnd,out RECT rect);
    [DllImport("user32.dll")] internal static extern bool ScreenToClient(IntPtr hwnd,ref POINT pt);
    [DllImport("user32.dll")] internal static extern bool SetWindowPos(IntPtr hwnd,IntPtr after,int x,int y,int w,int h,uint flags);
    [DllImport("user32.dll")] internal static extern bool ShowWindow(IntPtr hwnd,int cmd);
    [DllImport("user32.dll")] internal static extern bool RegisterHotKey(IntPtr hwnd,int id,uint mods,uint vk);
    [DllImport("user32.dll")] internal static extern bool UnregisterHotKey(IntPtr hwnd,int id);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] internal static extern int GetClassName(IntPtr hwnd,StringBuilder name,int size);
    internal static string ClassName(IntPtr hwnd) { var s=new StringBuilder(128); GetClassName(hwnd,s,128); return s.ToString(); }
    internal static IntPtr DesktopView() {
        IntPtr found=FindWindowEx(FindWindow("Progman",null),IntPtr.Zero,"SHELLDLL_DefView",null);
        if(found!=IntPtr.Zero) return found;
        EnumWindows((h,p)=> { var c=FindWindowEx(h,IntPtr.Zero,"SHELLDLL_DefView",null); if(c==IntPtr.Zero) return true; found=c; return false; },IntPtr.Zero);
        return found;
    }
}

sealed class RugState {
    internal double X=430,Y=300,Width=680,Angle=-4;
    internal double[] Fold=new double[4];
    internal int ScreenIndex;
    internal bool Visible=true;
    internal void Save() {
        try {
            var data=new List<double>{X,Y,Width,Angle,ScreenIndex,Visible?1:0}; data.AddRange(Fold);
            File.WriteAllLines(Path.Combine(Program.Root,"state.ini"),data.Select(v=>v.ToString("R",CultureInfo.InvariantCulture)).ToArray());
        } catch(Exception ex) { Program.Log("Save: "+ex.Message); }
    }
    internal bool Load() {
        try {
            double[] d=File.ReadAllLines(Path.Combine(Program.Root,"state.ini")).Select(s=>double.Parse(s,CultureInfo.InvariantCulture)).ToArray();
            if(d.Length!=10 || d.Any(v=>double.IsNaN(v)||double.IsInfinity(v))) return false;
            X=d[0]; Y=d[1]; Width=Math.Max(220,Math.Min(1600,d[2])); Angle=d[3]%360; ScreenIndex=Math.Max(0,(int)d[4]); Visible=d[5]!=0;
            for(int i=0;i<4;i++) Fold[i]=Math.Max(0,Math.Min(1,d[i+6])); return true;
        } catch { return false; }
    }
}

sealed class RugHost : IDisposable {
    readonly Application app;
    readonly RugState state=new RugState();
    HwndSource source;
    RugScene scene;
    Sweeper sweeper;
    IntPtr desktop;
    Forms.NotifyIcon tray;
    DispatcherTimer monitor;
    Window help;
    EventWaitHandle quitEvent,toggleEvent;
    RegisteredWaitHandle quitWait,toggleWait;
    double scaleX=1,scaleY=1;
    int scanCount,scanBusy;
    bool disposed,initial;
    System.Drawing.Rectangle work;
    internal RugHost(Application application) { app=application;initial=!state.Load(); }
    internal void Start() {
        if(!File.Exists(Path.Combine(Program.Root,"floor-enabled.txt"))){
            using(var icons=new DesktopIcons()){var list=icons.Read(1,1,0,0);string backup=Path.Combine(Program.Root,"original-icon-layout.bin");if(!File.Exists(backup))icons.SaveLayout(backup,list);icons.EnableFreePlacement();}FloorWallpaper.ApplyWood();
        }
        CreateSurface();
        quitEvent=new EventWaitHandle(false,EventResetMode.AutoReset,"Local\\DesktopRug.Quit");toggleEvent=new EventWaitHandle(false,EventResetMode.AutoReset,"Local\\DesktopRug.Toggle");
        quitWait=ThreadPool.RegisterWaitForSingleObject(quitEvent,(s,t)=>app.Dispatcher.BeginInvoke((Action)(()=>app.Shutdown())),null,-1,false);
        toggleWait=ThreadPool.RegisterWaitForSingleObject(toggleEvent,(s,t)=>app.Dispatcher.BeginInvoke((Action)Toggle),null,-1,false);
        tray=new Forms.NotifyIcon { Text="桌面地毯 · 双击打开说明",Icon=new System.Drawing.Icon(Path.Combine(Program.Root,"assets","rug.ico")),Visible=true };
        tray.ContextMenuStrip=BuildMenu();tray.DoubleClick+=(s,e)=>ShowHelp();
        monitor=new DispatcherTimer { Interval=TimeSpan.FromSeconds(2) };
        monitor.Tick+=(s,e)=> {
            if(source==null||source.IsDisposed||!Native.IsWindow(desktop)) { try { CreateSurface(); } catch(Exception ex) { Program.Log("Reconnect: "+ex.Message); } }
            if(source!=null&&!source.IsDisposed) {
                var displays=Forms.Screen.AllScreens;
                if(state.ScreenIndex>=displays.Length || displays[Math.Min(state.ScreenIndex,displays.Length-1)].WorkingArea!=work) { CreateSurface();ScanIcons(); }
                if(++scanCount%4==0)ScanIcons();
            }
        };monitor.Start();
        ScanIcons();WriteStatus();if(Program.Profiling)PerformanceProfile.Run(scene,app);
        if(initial) ShowHelp();
    }
    void CreateSurface() {
        if(sweeper!=null)sweeper.Dispose();if(scene!=null){scene.Stop();scene.Save();}if(source!=null&&!source.IsDisposed){Native.UnregisterHotKey(source.Handle,1);Native.UnregisterHotKey(source.Handle,2);Native.UnregisterHotKey(source.Handle,3);source.Dispose();}
        desktop=Native.DesktopView(); if(desktop==IntPtr.Zero)throw new InvalidOperationException("没有找到 Windows 桌面，请先启动资源管理器。");
        var screens=Forms.Screen.AllScreens; state.ScreenIndex=Math.Min(state.ScreenIndex,screens.Length-1); work=screens[state.ScreenIndex].WorkingArea;
        var pos=new Native.POINT { X=work.Left,Y=work.Top };Native.ScreenToClient(desktop,ref pos);
        var p=new HwndSourceParameters("DesktopRug.Surface") { ParentWindow=desktop,WindowStyle=Native.WS_CHILD|Native.WS_VISIBLE|Native.WS_CLIPSIBLINGS,ExtendedWindowStyle=Native.WS_EX_NOACTIVATE|Native.WS_EX_TOOLWINDOW,PositionX=pos.X,PositionY=pos.Y,Width=work.Width,Height=work.Height,UsesPerPixelTransparency=true };
        source=new HwndSource(p);source.CompositionTarget.BackgroundColor=Colors.Transparent;
        scaleX=source.CompositionTarget.TransformToDevice.M11;scaleY=source.CompositionTarget.TransformToDevice.M22;
        double w=work.Width/scaleX,h=work.Height/scaleY;
        if(initial) {state.Width=Math.Min(700,w*.58);state.X=Math.Min(w*.38,state.Width*.5+120);state.Y=h*.48;}
        scene=new RugScene(state,w,h,state.Save);scene.Menu=()=>tray.ContextMenuStrip.Show(Forms.Cursor.Position);scene.Cloth.LoadShape();scene.Clamp();scene.UpdateMesh();
        sweeper=new Sweeper(scene,scaleX,scaleY,pos.X,pos.Y,ScanIcons);
        source.RootVisual=scene;source.AddHook(Hook);
        Native.SetWindowPos(source.Handle,IntPtr.Zero,pos.X,pos.Y,work.Width,work.Height,0x0010|0x0040);
        if(!state.Visible)Native.ShowWindow(source.Handle,0);
        if(!Native.RegisterHotKey(source.Handle,1,0x4003,0x52))Program.Log("Ctrl+Alt+R unavailable; use tray.");
        if(!Native.RegisterHotKey(source.Handle,2,0x4007,0x51))Program.Log("Ctrl+Alt+Shift+Q unavailable; use tray.");
        if(!Native.RegisterHotKey(source.Handle,3,0x4003,0x42))Program.Log("Ctrl+Alt+B unavailable; use toolbar.");
        Program.Log("Desktop child attached; parent="+Native.ClassName(desktop)+"; DPI="+(scaleX*96).ToString(CultureInfo.InvariantCulture));
    }
    IntPtr Hook(IntPtr hwnd,int msg,IntPtr wp,IntPtr lp,ref bool handled) {
        if(msg==0x0084) {
            long v=lp.ToInt64();var pt=new Native.POINT { X=(short)(v&0xffff),Y=(short)((v>>16)&0xffff) };Native.ScreenToClient(hwnd,ref pt);
            handled=true;return new IntPtr(scene.HitSurface(new Point(pt.X/scaleX,pt.Y/scaleY))?1:-1);
        }
        if(msg==0x0021) {handled=true;return new IntPtr(3);}
        if(msg==0x0312) {if(wp.ToInt32()==1)Toggle();if(wp.ToInt32()==2)app.Shutdown();if(wp.ToInt32()==3)scene.ToggleBroom();handled=true;}
        return IntPtr.Zero;
    }
    Forms.ContextMenuStrip BuildMenu() {
        var m=new Forms.ContextMenuStrip();m.Items.Add("显示 / 收起地毯   Ctrl+Alt+R",null,(s,e)=>Toggle());
        m.Items.Add("把地毯铺平",null,(s,e)=>scene.Flatten());
        m.Items.Add("拿起 / 放下扫帚   Ctrl+Alt+B",null,(s,e)=>scene.ToggleBroom());
        m.Items.Add("撤销最近一次清扫",null,(s,e)=>sweeper.Undo());
        m.Items.Add("放大地毯",null,(s,e)=>scene.Scale(1.1));m.Items.Add("缩小地毯",null,(s,e)=>scene.Scale(.9));
        m.Items.Add("使用木地板壁纸",null,(s,e)=>FloorWallpaper.ApplyWood());m.Items.Add("恢复原来的壁纸",null,(s,e)=>FloorWallpaper.Restore());
        m.Items.Add("恢复原图标布局与网格设置",null,(s,e)=>{using(var icons=new DesktopIcons())icons.RestoreOriginal();ScanIcons();});
        m.Items.Add("恢复大小和位置",null,(s,e)=>Reset());
        m.Items.Add("使用说明",null,(s,e)=>ShowHelp());
        if(Forms.Screen.AllScreens.Length>1) {var displays=new Forms.ToolStripMenuItem("放到显示器");for(int i=0;i<Forms.Screen.AllScreens.Length;i++) {int index=i;displays.DropDownItems.Add("显示器 "+(i+1),null,(s,e)=> {state.ScreenIndex=index;initial=true;CreateSurface();initial=false;state.Save();ScanIcons();WriteStatus();});}m.Items.Add(displays);}
        m.Items.Add(new Forms.ToolStripSeparator());m.Items.Add("退出地毯   Ctrl+Alt+Shift+Q",null,(s,e)=>app.Shutdown());return m;
    }
    void Toggle() {state.Visible=!state.Visible;if(source!=null&&!source.IsDisposed)Native.ShowWindow(source.Handle,state.Visible?5:0);state.Save();WriteStatus();}
    void Reset() {state.Width=Math.Min(700,scene.Width*.58);state.X=Math.Min(scene.Width*.38,state.Width*.5+120);state.Y=scene.Height*.48;state.Angle=-4;scene.Flatten();state.Visible=true;Native.ShowWindow(source.Handle,5);state.Save();}
    void ScanIcons() {
        if(Interlocked.Exchange(ref scanBusy,1)!=0)return;
        IntPtr list=Native.FindWindowEx(desktop,IntPtr.Zero,"SysListView32",null);if(list==IntPtr.Zero){Interlocked.Exchange(ref scanBusy,0);return;}
        var region=work;double sx=scaleX,sy=scaleY;
        ThreadPool.QueueUserWorkItem(_=> {
            var icons=new List<Rect>();
            try {
                var el=AutomationElement.FromHandle(list);
                var items=el.FindAll(TreeScope.Children,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.ListItem));
                foreach(AutomationElement item in items) {var r=item.Current.BoundingRectangle;if(r.IsEmpty||r.Width<=0||!r.IntersectsWith(new Rect(region.Left,region.Top,region.Width,region.Height)))continue;icons.Add(new Rect((r.X-region.Left)/sx,(r.Y-region.Top)/sy,r.Width/sx,r.Height/sy));if(icons.Count>=200)break;}
                if(!disposed)app.Dispatcher.BeginInvoke((Action)(()=> {if(!disposed&&scene!=null) {if(!scene.Cloth.Icons.SequenceEqual(icons))scene.SetIcons(icons);WriteStatus();}}));
            } catch(Exception ex) {Program.Log("Icon scan: "+ex.Message);} finally {Interlocked.Exchange(ref scanBusy,0);}
        });
    }
    void WriteStatus() {
        try {File.WriteAllText(Path.Combine(Program.Root,"status.txt"),"Version=3\nRunning=True\nDesktopParent="+Native.ClassName(desktop)+"\nAttached="+(source!=null&&!source.IsDisposed&&Native.GetParent(source.Handle)==desktop)+"\nPerPixelTransparency="+(source!=null&&!source.IsDisposed&&source.UsesPerPixelOpacity)+"\nVisible="+state.Visible+"\nIconObstacles="+(scene==null?0:scene.Cloth.Icons.Count)+"\nDpiScale="+scaleX.ToString(CultureInfo.InvariantCulture)+"\nDisplay="+work.Width+"x"+work.Height+"\n");} catch {}
    }
    void ShowHelp() {
        if(help!=null){help.Activate();return;}
        help=new Window {Title="桌面地毯",Width=500,Height=485,ResizeMode=ResizeMode.NoResize,WindowStartupLocation=WindowStartupLocation.CenterScreen,Background=new SolidColorBrush(Color.FromRgb(246,242,234)),FontFamily=new FontFamily("Microsoft YaHei UI"),Foreground=new SolidColorBrush(Color.FromRgb(44,43,39))};
        var panel=new StackPanel {Margin=new Thickness(32)};
        panel.Children.Add(new TextBlock {Text="给桌面盖一张地毯",FontSize=25,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,0,0,8)});
        panel.Children.Add(new TextBlock {Text="文件留在原地，掀开就能找到。",FontSize=14,Foreground=Brushes.DimGray,Margin=new Thickness(0,0,0,20)});
        string[] lines={"拖动边缘     圆弧翻折，反向拖动展开","拖动中间 / Shift + 拖动     平移地毯","双击 / 铺平     展开后可换方向翻折","滚轮 / ＋ −     放大、缩小","Shift + 滚轮     旋转地毯","扫帚     自动铺开；按住扫过图标，右键结束","撤销清扫     恢复清扫前的图标位置","Ctrl+Alt+R 显隐 · Ctrl+Alt+Shift+Q 退出"};
        foreach(string line in lines)panel.Children.Add(new TextBlock {Text=line,FontSize=14,Margin=new Thickness(0,0,0,10)});
        var go=new Button {Content="知道了 · 去桌面试试",Height=40,Margin=new Thickness(0,9,0,0),Background=new SolidColorBrush(Color.FromRgb(116,43,35)),Foreground=Brushes.White,BorderThickness=new Thickness(0)};go.Click+=(s,e)=>help.Close();panel.Children.Add(go);
        help.Content=panel;help.Closed+=(s,e)=>help=null;help.Show();
    }
    public void Dispose() {
        disposed=true;if(scene!=null){scene.Stop();scene.Save();}state.Save();if(sweeper!=null)sweeper.Dispose();if(monitor!=null)monitor.Stop();
        if(tray!=null){tray.Visible=false;tray.Dispose();}if(quitWait!=null)quitWait.Unregister(null);if(toggleWait!=null)toggleWait.Unregister(null);
        if(quitEvent!=null)quitEvent.Dispose();if(toggleEvent!=null)toggleEvent.Dispose();
        if(source!=null&&!source.IsDisposed){Native.UnregisterHotKey(source.Handle,1);Native.UnregisterHotKey(source.Handle,2);Native.UnregisterHotKey(source.Handle,3);source.Dispose();}
        try {File.WriteAllText(Path.Combine(Program.Root,"status.txt"),"Running=False\n");} catch {}
    }
}

}

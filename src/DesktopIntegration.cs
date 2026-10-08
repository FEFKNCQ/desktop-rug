using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows;
using Microsoft.Win32;

namespace DesktopRug {
[ComImport,Guid("6D5140C1-7436-11CE-8034-00AA006009FA"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IServiceProvider { [PreserveSig]int QueryService(ref Guid service,ref Guid iid,out IntPtr result); }
sealed partial class DesktopIcons : IDisposable {
    IntPtr view;
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int GetView(IntPtr self,out IntPtr result);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int CountItems(IntPtr self,uint flags,out int count);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int GetItem(IntPtr self,int index,out IntPtr pidl);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int Position(IntPtr self,IntPtr pidl,out Native.POINT point);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int MoveItems(IntPtr self,uint count,[In]IntPtr[] pidls,[In]Native.POINT[] points,uint flags);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int GetFlags(IntPtr self,out uint flags);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int SetFlags(IntPtr self,uint mask,uint flags);
    [DllImport("shell32.dll")]static extern uint ILGetSize(IntPtr pidl);
    [DllImport("shell32.dll",CharSet=CharSet.Unicode)]static extern bool SHGetPathFromIDList(IntPtr pidl,StringBuilder path);
    T Slot<T>(int slot) where T:class {return Marshal.GetDelegateForFunctionPointer(Marshal.ReadIntPtr(Marshal.ReadIntPtr(view),slot*IntPtr.Size),typeof(T)) as T;}
    internal sealed class Item {internal int ViewIndex,LiveKey=-1;internal byte[] Id;internal Native.POINT Position;internal Point Center;internal bool Sweepable;internal string Path;internal string Name;internal System.Windows.Media.ImageSource Image;}
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct SHFILEINFO {internal IntPtr Icon;internal int Index;internal uint Attributes;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)]internal string DisplayName;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=80)]internal string TypeName;}
    [DllImport("shell32.dll",CharSet=CharSet.Unicode)]static extern IntPtr SHGetFileInfo(string path,uint attributes,out SHFILEINFO info,uint size,uint flags);
    [DllImport("shell32.dll",CharSet=CharSet.Unicode,EntryPoint="SHGetFileInfoW")]static extern IntPtr SHGetPidlInfo(IntPtr pidl,uint attributes,out SHFILEINFO info,uint size,uint flags);
    [DllImport("shell32.dll")]static extern int SHGetNameFromIDList(IntPtr pidl,uint kind,out IntPtr name);
    [DllImport("user32.dll")]static extern bool DestroyIcon(IntPtr icon);
    internal void LoadImage(Item item){if(item.Image!=null)return;SHFILEINFO info;IntPtr pidl=Marshal.AllocCoTaskMem(item.Id.Length);try{Marshal.Copy(item.Id,0,pidl,item.Id.Length);SHGetPidlInfo(pidl,0,out info,(uint)Marshal.SizeOf(typeof(SHFILEINFO)),0x108);}finally{Marshal.FreeCoTaskMem(pidl);}if(info.Icon==IntPtr.Zero)return;try{var image=System.Windows.Interop.Imaging.CreateBitmapSourceFromHIcon(info.Icon,Int32Rect.Empty,System.Windows.Media.Imaging.BitmapSizeOptions.FromEmptyOptions());image.Freeze();item.Image=image;}finally{DestroyIcon(info.Icon);}}
    internal DesktopIcons(){
        object windows=Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("9BA05972-F6A8-11CF-A442-00A0C90A8F39")));
        object location=0,empty=null;int hwnd;dynamic shell=windows;object desktop=shell.FindWindowSW(ref location,ref empty,8,out hwnd,1);
        if(desktop==null)throw new InvalidOperationException("找不到原生桌面视图");
        var provider=(IServiceProvider)desktop;var sid=new Guid("4C96BE40-915C-11CF-99D3-00AA004AE837");var iid=new Guid("000214E2-0000-0000-C000-000000000046");IntPtr browser,active;
        Marshal.ThrowExceptionForHR(provider.QueryService(ref sid,ref iid,out browser));
        try{var query=(GetView)Marshal.GetDelegateForFunctionPointer(Marshal.ReadIntPtr(Marshal.ReadIntPtr(browser),15*IntPtr.Size),typeof(GetView));Marshal.ThrowExceptionForHR(query(browser,out active));try{var folder=new Guid("1AF3A467-214F-4298-908E-06B03E0B39F9");Marshal.ThrowExceptionForHR(Marshal.QueryInterface(active,ref folder,out view));}finally{Marshal.Release(active);}}finally{Marshal.Release(browser);Marshal.ReleaseComObject(desktop);Marshal.ReleaseComObject(windows);}
    }
    internal uint Flags {get{uint f;Marshal.ThrowExceptionForHR(Slot<GetFlags>(25)(view,out f));return f;}}
    internal void EnableFreePlacement(){
        string file=Path.Combine(Program.Root,"original-icon-flags.txt");if(!File.Exists(file))File.WriteAllText(file,Flags.ToString());
        if((Flags&5)!=0)Marshal.ThrowExceptionForHR(Slot<SetFlags>(24)(view,5,0));if((Flags&5)!=0)throw new InvalidOperationException("桌面未接受自由摆放设置");
    }
    internal void RestoreOriginal(){string layout=Path.Combine(Program.Root,"original-icon-layout.bin"),flags=Path.Combine(Program.Root,"original-icon-flags.txt");if(File.Exists(layout))RestoreLayout(layout);uint value;if(File.Exists(flags)&&uint.TryParse(File.ReadAllText(flags),out value))Marshal.ThrowExceptionForHR(Slot<SetFlags>(24)(view,5,value&5));}
    internal List<Item> Read(double scaleX,double scaleY,int offsetX,int offsetY){
        int count;Marshal.ThrowExceptionForHR(Slot<CountItems>(7)(view,2,out count));var result=new List<Item>();ReadLiveView(count);
        for(int i=0;i<count;i++){IntPtr pidl;if(Slot<GetItem>(6)(view,i,out pidl)<0||pidl==IntPtr.Zero)continue;try{Native.POINT pt;if(Slot<Position>(11)(view,pidl,out pt)<0)continue;int size=(int)ILGetSize(pidl);if(size<2||size>65536)continue;byte[] bytes=new byte[size];Marshal.Copy(pidl,bytes,0,size);var path=new StringBuilder(32768);bool sweepable=SHGetPathFromIDList(pidl,path);string name=System.IO.Path.GetFileNameWithoutExtension(path.ToString());IntPtr display;if(SHGetNameFromIDList(pidl,0,out display)>=0&&display!=IntPtr.Zero){name=Marshal.PtrToStringUni(display);Marshal.FreeCoTaskMem(display);}result.Add(new Item{Id=bytes,ViewIndex=i,LiveKey=LiveId(i),Position=pt,Sweepable=true,Path=path.ToString(),Name=name,Center=new Point((pt.X-offsetX)/scaleX+24,(pt.Y-offsetY)/scaleY+24)});}finally{Marshal.FreeCoTaskMem(pidl);}}
        var liveKeys=new HashSet<int>();bool unique=true;foreach(var item in result)if(item.LiveKey>=0&&!liveKeys.Add(item.LiveKey))unique=false;if(!unique)foreach(var item in result)item.LiveKey=-1;
        return result;
    }
    internal void Move(List<Item> items,List<Native.POINT> positions){
        if(items.Count==0)return;var ids=new IntPtr[items.Count];try{for(int n=0;n<items.Count;n++){ids[n]=Marshal.AllocCoTaskMem(items[n].Id.Length);Marshal.Copy(items[n].Id,0,ids[n],items[n].Id.Length);}Marshal.ThrowExceptionForHR(Slot<MoveItems>(16)(view,(uint)items.Count,ids,positions.ToArray(),0x80));for(int n=0;n<items.Count;n++)items[n].Position=positions[n];}finally{foreach(var id in ids)if(id!=IntPtr.Zero)Marshal.FreeCoTaskMem(id);}
    }
    internal void SaveLayout(string path,List<Item> items){using(var w=new BinaryWriter(File.Create(path))){w.Write(items.Count);foreach(var i in items){w.Write(i.Id.Length);w.Write(i.Id);w.Write(i.Position.X);w.Write(i.Position.Y);}}}
    internal void RestoreLayout(string path){
        var items=new List<Item>();var positions=new List<Native.POINT>();using(var r=new BinaryReader(File.OpenRead(path))){int count=r.ReadInt32();if(count<0||count>10000)throw new IOException("无效的布局备份");for(int n=0;n<count;n++){int length=r.ReadInt32();if(length<2||length>65536)throw new IOException("无效的图标标识");byte[] id=r.ReadBytes(length);if(id.Length!=length)throw new EndOfStreamException();var pt=new Native.POINT{X=r.ReadInt32(),Y=r.ReadInt32()};items.Add(new Item{Id=id,Position=pt});positions.Add(pt);}}Move(items,positions);
    }
    public void Dispose(){if(view!=IntPtr.Zero){Marshal.Release(view);view=IntPtr.Zero;}}
}
static class FloorWallpaper {
    static string SnapshotFile {get{return Path.Combine(Program.Root,"wallpaper-backup","image.png");}}
    static string SnapshotSettings {get{return Path.Combine(Program.Root,"wallpaper-backup","settings.txt");}}
    static bool IsManaged(string file){
        if(string.IsNullOrWhiteSpace(file))return false;
        string full=Path.GetFullPath(file);
        if(string.Equals(full,SnapshotFile,StringComparison.OrdinalIgnoreCase))return true;
        foreach(var style in Styles())if(style.file!=null&&string.Equals(full,Path.Combine(Program.Root,"assets",style.file),StringComparison.OrdinalIgnoreCase))return true;
        return false;
    }
    internal static void BackupSource(string source,string wallpaperStyle,string tile){
        if(!File.Exists(source))throw new FileNotFoundException("原壁纸文件已不存在，请先在 Windows 中设置一次要保留的壁纸");
        Directory.CreateDirectory(Path.GetDirectoryName(SnapshotFile));string temp=SnapshotFile+".tmp";
        using(var input=new FileStream(source,FileMode.Open,FileAccess.Read,FileShare.ReadWrite))using(var image=System.Drawing.Image.FromStream(input))image.Save(temp,System.Drawing.Imaging.ImageFormat.Png);
        if(File.Exists(SnapshotFile))File.Replace(temp,SnapshotFile,SnapshotFile+".previous");else File.Move(temp,SnapshotFile);
        File.WriteAllLines(SnapshotSettings,new[]{source,wallpaperStyle,tile});
    }
    static void PreserveOriginal(){
        string current=Current();
        using(var key=Registry.CurrentUser.OpenSubKey(@"Control Panel\Desktop",false)){
            if(!IsManaged(current)&&File.Exists(current)){
                BackupSource(current,Convert.ToString(key.GetValue("WallpaperStyle","10")),Convert.ToString(key.GetValue("TileWallpaper","0")));return;
            }
        }
        // Migrate legacy path-only backups without replacing an existing snapshot.
        string legacy=Path.Combine(Program.Root,"original-wallpaper.txt");
        if(!File.Exists(SnapshotFile)&&File.Exists(legacy)){var lines=File.ReadAllLines(legacy);if(lines.Length>=3&&File.Exists(lines[0])&&!IsManaged(lines[0]))BackupSource(lines[0],lines[1],lines[2]);}
    }
    public sealed class Style {public string id {get;set;}public string name {get;set;}public string file {get;set;}}
    internal static Style[] Styles(){
        var styles=new System.Web.Script.Serialization.JavaScriptSerializer().Deserialize<Style[]>(File.ReadAllText(Path.Combine(Program.Root,"assets","wallpapers.json")));
        var ids=new HashSet<string>();
        foreach(var style in styles){
            if(string.IsNullOrWhiteSpace(style.id)||string.IsNullOrWhiteSpace(style.name)||!ids.Add(style.id))throw new IOException("壁纸风格配置无效");
            if(style.id!="original"&&(string.IsNullOrWhiteSpace(style.file)||Path.GetFileName(style.file)!=style.file))throw new IOException("壁纸文件配置无效");
        }
        return styles;
    }
    internal static string Selected(){string current=Current();foreach(var style in Styles())if(style.file!=null&&string.Equals(current,Path.Combine(Program.Root,"assets",style.file),StringComparison.OrdinalIgnoreCase))return style.id;return "original";}
    internal static object ChooseOriginal(){
        using(var dialog=new System.Windows.Forms.OpenFileDialog()){
            dialog.Title="选择要保留的原壁纸";dialog.Filter="壁纸图片|*.png;*.jpg;*.jpeg;*.bmp";
            if(dialog.ShowDialog()!=System.Windows.Forms.DialogResult.OK)return new{cancelled=true,wallpaper=Selected()};
            BackupSource(dialog.FileName,"10","0");RestoreSnapshot();return Info();
        }
    }
    internal static object RecoverOriginal(string source){
        bool known=false;using(var key=Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Explorer\Wallpapers")){
            if(key!=null)for(int n=0;n<5;n++)if(string.Equals(source,Convert.ToString(key.GetValue("BackgroundHistoryPath"+n)),StringComparison.OrdinalIgnoreCase))known=true;
        }
        if(!known||IsManaged(source))throw new ArgumentException("此图片不在 Windows 原壁纸历史中");
        BackupSource(source,"10","0");RestoreSnapshot();return Info();
    }
    internal static object Info(){return new{wallpaper=Selected(),wallpapers=Styles(),path=Current(),originalAvailable=File.Exists(SnapshotFile)};}
    [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool SystemParametersInfo(uint action,uint value,StringBuilder text,uint flags);
    [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool SystemParametersInfo(uint action,uint value,string text,uint flags);
    internal static string Current(){var s=new StringBuilder(32768);if(!SystemParametersInfo(0x73,(uint)s.Capacity,s,0))throw new System.ComponentModel.Win32Exception();return s.ToString();}
    internal static void ApplyWood(){ApplyStyle("wood");}
    internal static void ApplyStyle(string id){
        Style selected=null;foreach(var style in Styles())if(style.id==id){selected=style;break;}
        if(selected==null)throw new ArgumentException("未知壁纸风格");
        if(id=="original"){Restore();return;}
        string image=Path.Combine(Program.Root,"assets",selected.file);
        if(!File.Exists(image))throw new FileNotFoundException("找不到壁纸图片",image);
        PreserveOriginal();
        string file=Path.Combine(Program.Root,"original-wallpaper.txt");
        using(var key=Registry.CurrentUser.OpenSubKey(@"Control Panel\Desktop",true)){
            if(!File.Exists(file))File.WriteAllLines(file,new[]{Current(),Convert.ToString(key.GetValue("WallpaperStyle","10")),Convert.ToString(key.GetValue("TileWallpaper","0"))});
            key.SetValue("WallpaperStyle","10");key.SetValue("TileWallpaper","0");
        }
        if(!SystemParametersInfo(0x14,0,image,3))throw new System.ComponentModel.Win32Exception();
        File.WriteAllText(Path.Combine(Program.Root,"floor-enabled.txt"),id);
    }
    internal static void Restore(){
        PreserveOriginal();
        RestoreSnapshot();
    }
    static void RestoreSnapshot(){
        if(!File.Exists(SnapshotFile)||!File.Exists(SnapshotSettings))throw new IOException("原壁纸缓存已丢失，请先在 Windows 中设置一次要保留的壁纸；以后会保存独立图片备份");
        var lines=File.ReadAllLines(SnapshotSettings);if(lines.Length<3)throw new IOException("原壁纸备份不完整");
        using(var key=Registry.CurrentUser.OpenSubKey(@"Control Panel\Desktop",true)){key.SetValue("WallpaperStyle",lines[1]);key.SetValue("TileWallpaper",lines[2]);}
        if(!SystemParametersInfo(0x14,0,SnapshotFile,3))throw new System.ComponentModel.Win32Exception();File.WriteAllText(Path.Combine(Program.Root,"floor-enabled.txt"),"original");
    }
}
}

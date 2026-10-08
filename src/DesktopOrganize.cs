using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;

namespace DesktopRug {
static class IconKinds {
    static readonly HashSet<string> Pictures=new HashSet<string>(".png .jpg .jpeg .jpe .jfif .webp .gif .bmp .dib .tif .tiff .ico .heic .heif .avif .svg .raw .cr2 .cr3 .nef .arw .dng .psd .xcf".Split(' '),StringComparer.OrdinalIgnoreCase);
    static readonly HashSet<string> Launchers=new HashSet<string>(".exe .com .bat .cmd .lnk .url .appref-ms .application".Split(' '),StringComparer.OrdinalIgnoreCase);
    internal static string PathKind(string path){return Pictures.Contains(Path.GetExtension(path))?"pictures":Launchers.Contains(Path.GetExtension(path))?"apps":"files";}
    internal static string Of(DesktopIcons.Item item,object shell){
        // Shell-only icons are navigation entries; PIDLs can position them too.
        if(string.IsNullOrEmpty(item.Path))return "apps";
        if(Directory.Exists(item.Path))return "files";
        string extension=Path.GetExtension(item.Path);
        if(extension.Equals(".lnk",StringComparison.OrdinalIgnoreCase)&&shell!=null){
            object link=null;try{link=((dynamic)shell).CreateShortcut(item.Path);string target=((dynamic)link).TargetPath;
                if(!string.IsNullOrWhiteSpace(target))return Directory.Exists(target)?"files":target.StartsWith("::")||target.StartsWith("shell:",StringComparison.OrdinalIgnoreCase)?"apps":PathKind(target);
            }catch{}finally{if(link!=null&&Marshal.IsComObject(link))Marshal.ReleaseComObject(link);}
            return "apps";
        }
        if(extension.Equals(".url",StringComparison.OrdinalIgnoreCase)){
            try{string line=File.ReadLines(item.Path).Take(128).FirstOrDefault(s=>s.StartsWith("URL=",StringComparison.OrdinalIgnoreCase));Uri target;
                if(line!=null&&Uri.TryCreate(line.Substring(4),UriKind.Absolute,out target)&&target.IsFile)return Directory.Exists(target.LocalPath)?"files":PathKind(target.LocalPath);
            }catch{}return "apps";
        }
        return PathKind(item.Path);
    }
}
static partial class DesktopBridge {
    static object OrganizeInfo(){
        ReadIcons();object shell=null;
        try{try{shell=Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));}catch{}
            return icons.Select(i=>new{id=Convert.ToBase64String(i.Id),x=i.Center.X,y=i.Center.Y,sweepable=i.Sweepable,name=i.Name,fileName=Path.GetFileName(i.Path),category=IconKinds.Of(i,shell)}).ToArray();
        }finally{if(shell!=null&&Marshal.IsComObject(shell))Marshal.ReleaseComObject(shell);}
    }
    static object Organize(Dictionary<string,object> args){
        RevealIconView();ReadIcons();
        var requests=((System.Collections.IEnumerable)args["positions"]).Cast<object>().Select(o=>(Dictionary<string,object>)o).ToList();
        var ids=new HashSet<string>(icons.Select(i=>Convert.ToBase64String(i.Id)));
        if(requests.Select(r=>(string)r["id"]).Distinct().Count()!=requests.Count||requests.Any(r=>!ids.Contains((string)r["id"])))throw new InvalidOperationException("桌面图标已变化，请重新整理");
        var area=System.Windows.Forms.Screen.PrimaryScreen.WorkingArea;
        foreach(var r in requests){double x=Number(r,"x"),y=Number(r,"y");if(x<24||y<24||x>area.Width/scale-24||y>area.Height/scale-45)throw new ArgumentException("整理位置超出桌面范围");}
        bool test=args.ContainsKey("test")&&(bool)args["test"];
        if(test&&icons.Where(i=>requests.Any(r=>(string)r["id"]==Convert.ToBase64String(i.Id))).Any(i=>!Path.GetFileName(i.Path).StartsWith("DesktopRug-gpu-check-")))throw new InvalidOperationException("Test is restricted to its own files");
        Desktop().EnableFreePlacement();backedUp=false;backup=Path.Combine(Program.Root,"before-last-sweep.bin");
        CommitPush(args);return ReadIcons();
    }
}
}

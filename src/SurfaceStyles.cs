using System;
using System.IO;
using System.Collections.Generic;
using System.Web.Script.Serialization;
namespace DesktopRug {
static class SurfaceStyles {
    public sealed class Style {public string id {get;set;}public string name {get;set;}public string file {get;set;}public string material {get;set;}}
    internal static Style[] Styles(){
        var styles=new JavaScriptSerializer().Deserialize<Style[]>(File.ReadAllText(Path.Combine(Program.Root,"assets","rugs.json")));
        var ids=new HashSet<string>();
        foreach(var style in styles){
            if(string.IsNullOrWhiteSpace(style.id)||string.IsNullOrWhiteSpace(style.name)||!ids.Add(style.id))throw new IOException("毯子风格配置无效");
            if(style.file!=null&&(string.IsNullOrWhiteSpace(style.file)||Path.GetFileName(style.file)!=style.file))throw new IOException("毯子贴图配置无效");
            if(style.material!="plush"&&style.material!="short"&&style.material!="paper")throw new IOException("未知毯子材质");
        }
        return styles;
    }
    internal static string Selected(){string file=Path.Combine(Program.Root,"rug-style.txt");return File.Exists(file)?File.ReadAllText(file).Trim():"plush";}
    internal static string Select(string id){
        Style selected=null;foreach(var style in Styles())if(style.id==id){selected=style;break;}
        if(selected==null)throw new ArgumentException("未知毯子风格");
        if(selected.file!=null&&!File.Exists(Path.Combine(Program.Root,"assets",selected.file)))throw new FileNotFoundException("找不到毯子贴图");
        File.WriteAllText(Path.Combine(Program.Root,"rug-style.txt"),id);return id;
    }
}
}

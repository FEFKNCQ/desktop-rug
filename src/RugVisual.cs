using System;
using System.Collections.Generic;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Media.Media3D;

namespace DesktopRug {
sealed class RugVisual:Viewport3D {
    readonly Cloth cloth;
    readonly MeshGeometry3D top=new MeshGeometry3D(),bottom=new MeshGeometry3D(),binding=new MeshGeometry3D();
    readonly MeshGeometry3D foldShadow=new MeshGeometry3D();
    readonly int[] boundary;
    internal RugVisual(Cloth c,double width,double height){
        cloth=c;
        Camera=new OrthographicCamera(new Point3D(width/2,-height/2,2000),new Vector3D(0,0,-1),new Vector3D(0,1,0),width){NearPlaneDistance=.1,FarPlaneDistance=4000};
        var uv=new PointCollection();var indices=new Int32Collection();var reverse=new Int32Collection();
        for(int j=0;j<=Cloth.NY;j++)for(int i=0;i<=Cloth.NX;i++)uv.Add(new Point(i/(double)Cloth.NX,j/(double)Cloth.NY));
        for(int j=0;j<Cloth.NY;j++)for(int i=0;i<Cloth.NX;i++){int n=j*(Cloth.NX+1)+i;foreach(int v in new[]{n,n+Cloth.NX+1,n+1,n+1,n+Cloth.NX+1,n+Cloth.NX+2})indices.Add(v);foreach(int v in new[]{n,n+1,n+Cloth.NX+1,n+1,n+Cloth.NX+2,n+Cloth.NX+1})reverse.Add(v);}
        uv.Freeze();indices.Freeze();reverse.Freeze();top.TextureCoordinates=bottom.TextureCoordinates=uv;top.TriangleIndices=indices;bottom.TriangleIndices=reverse;
        var edge=new List<int>();for(int i=0;i<=Cloth.NX;i++)edge.Add(i);for(int j=1;j<=Cloth.NY;j++)edge.Add(j*(Cloth.NX+1)+Cloth.NX);for(int i=Cloth.NX-1;i>=0;i--)edge.Add(Cloth.NY*(Cloth.NX+1)+i);for(int j=Cloth.NY-1;j>0;j--)edge.Add(j*(Cloth.NX+1));boundary=edge.ToArray();
        var edgeIndices=new Int32Collection();var edgeUv=new PointCollection();
        for(int i=0;i<boundary.Length;i++){int n=i*2,k=((i+1)%boundary.Length)*2;foreach(int v in new[]{n,k,n+1,n+1,k,k+1})edgeIndices.Add(v);edgeUv.Add(new Point(i,0));edgeUv.Add(new Point(i,1));}
        edgeIndices.Freeze();edgeUv.Freeze();binding.TriangleIndices=edgeIndices;binding.TextureCoordinates=edgeUv;
        var bitmap=new BitmapImage();bitmap.BeginInit();bitmap.CacheOption=BitmapCacheOption.OnLoad;bitmap.UriSource=new Uri(Path.Combine(Program.Root,"assets","persian-rug.png"));bitmap.EndInit();bitmap.Freeze();
        var front=Fabric(bitmap,false);var back=Fabric(bitmap,true);
        var edgeBrush=new LinearGradientBrush();edgeBrush.GradientStops.Add(new GradientStop(Color.FromRgb(86,52,41),0));edgeBrush.GradientStops.Add(new GradientStop(Color.FromRgb(173,137,91),.28));edgeBrush.GradientStops.Add(new GradientStop(Color.FromRgb(108,78,54),.65));edgeBrush.GradientStops.Add(new GradientStop(Color.FromRgb(65,40,31),1));edgeBrush.StartPoint=new Point(0,0);edgeBrush.EndPoint=new Point(0,1);edgeBrush.Freeze();var edgeMaterial=new DiffuseMaterial(edgeBrush);edgeMaterial.Freeze();
        var group=new Model3DGroup();
        group.Children.Add(new AmbientLight(Color.FromRgb(137,137,137)));
        group.Children.Add(new DirectionalLight(Color.FromRgb(154,149,140),new Vector3D(-.35,-.65,-1)));
        group.Children.Add(new DirectionalLight(Color.FromRgb(35,37,40),new Vector3D(-.8,.3,-.4)));
        group.Children.Add(new GeometryModel3D(top,front));group.Children.Add(new GeometryModel3D(bottom,back));group.Children.Add(new GeometryModel3D(binding,edgeMaterial){BackMaterial=edgeMaterial});
        var shade=new DiffuseMaterial(new SolidColorBrush(Color.FromArgb(88,12,8,5)));shade.Freeze();group.Children.Add(new GeometryModel3D(foldShadow,shade){BackMaterial=shade});
        Children.Add(new ModelVisual3D{Content=group});Update();
    }
    static Material Fabric(BitmapImage bitmap,bool back){
        var drawing=new DrawingGroup();using(var dc=drawing.Open()){
            if(back){dc.DrawRectangle(new SolidColorBrush(Color.FromRgb(156,137,104)),null,new Rect(0,0,1024,683));dc.PushOpacity(.13);dc.DrawImage(bitmap,new Rect(0,0,1024,683));dc.Pop();}else dc.DrawImage(bitmap,new Rect(0,0,1024,683));
            var light=new Pen(new SolidColorBrush(Color.FromArgb(back?(byte)54:(byte)26,255,238,201)),back?1:.65);var dark=new Pen(new SolidColorBrush(Color.FromArgb(back?(byte)42:(byte)22,36,24,17)),.7);
            for(int y=0;y<683;y+=3){dc.DrawLine(light,new Point(0,y),new Point(1024,y));dc.DrawLine(dark,new Point(0,y+1.2),new Point(1024,y+1.2));}
            for(int x=0;x<1024;x+=4)dc.DrawLine(dark,new Point(x,0),new Point(x+18,683));
        }drawing.Freeze();var brush=new DrawingBrush(drawing);brush.Freeze();
        var material=new MaterialGroup();material.Children.Add(new DiffuseMaterial(brush));material.Children.Add(new SpecularMaterial(new SolidColorBrush(Color.FromArgb(20,216,199,167)),8));material.Freeze();return material;
    }
    internal void Update(){
        var front=new Point3DCollection(cloth.Points.Length);var back=new Point3DCollection(cloth.Points.Length);var ns=new Vector3DCollection(cloth.Points.Length);var bn=new Vector3DCollection(cloth.Points.Length);
        for(int i=0;i<cloth.Points.Length;i++){var n=cloth.Normals[i];front.Add(cloth.Points[i]+n*Cloth.HalfThickness);back.Add(cloth.Points[i]-n*Cloth.HalfThickness);ns.Add(n);bn.Add(-n);}
        var edges=new Point3DCollection(boundary.Length*2);foreach(int i in boundary){edges.Add(front[i]);edges.Add(back[i]);}
        front.Freeze();back.Freeze();ns.Freeze();bn.Freeze();edges.Freeze();top.Positions=front;bottom.Positions=back;top.Normals=ns;bottom.Normals=bn;binding.Positions=edges;
        var shadowPoints=new Point3DCollection();var shadowIndices=new Int32Collection();
        if(cloth.FoldDepth>.1)for(int j=0;j<Cloth.NY;j+=2)for(int i=0;i<Cloth.NX;i+=2){
            int a=j*(Cloth.NX+1)+i,b=a+2,c=(j+2)*(Cloth.NX+1)+i,d=c+2;
            if(cloth.Normals[a].Z>-.2||cloth.Normals[b].Z>-.2||cloth.Normals[c].Z>-.2||cloth.Normals[d].Z>-.2)continue;
            var pts=new[]{cloth.Points[a],cloth.Points[b],cloth.Points[c],cloth.Points[d]};bool inside=true;
            for(int k=0;k<4;k++){pts[k].X-=7;pts[k].Y-=7;if(!cloth.ContainsLower(new Point(pts[k].X,-pts[k].Y)))inside=false;pts[k].Z=cloth.SurfaceHeight(pts[k].X,-pts[k].Y)+Cloth.HalfThickness+2.0;}
            if(!inside)continue;int n=shadowPoints.Count;foreach(var p in pts)shadowPoints.Add(p);foreach(int v in new[]{n,n+1,n+2,n+1,n+3,n+2})shadowIndices.Add(v);
        }
        shadowPoints.Freeze();shadowIndices.Freeze();foldShadow.Positions=shadowPoints;foldShadow.TriangleIndices=shadowIndices;
    }
}
sealed class FloorShadow:FrameworkElement {
    readonly Cloth cloth;Geometry shape;
    internal FloorShadow(Cloth c){cloth=c;IsHitTestVisible=false;}
    internal void Update(){
        var g=new StreamGeometry{FillRule=FillRule.Nonzero};using(var dc=g.Open()){
            for(int j=0;j<Cloth.NY;j+=4)for(int i=0;i<Cloth.NX;i+=4){int a=j*(Cloth.NX+1)+i,b=a+4,c=(j+4)*(Cloth.NX+1)+i,d=c+4;var ps=new[]{Project(a),Project(b),Project(d),Project(c)};double cross=Vector.CrossProduct(ps[1]-ps[0],ps[2]-ps[0]);if(cross<0)Array.Reverse(ps);dc.BeginFigure(ps[0],true,true);for(int k=1;k<4;k++)dc.LineTo(ps[k],true,false);}
        }g.Freeze();shape=g;InvalidateVisual();
    }
    Point Project(int i){var p=cloth.Points[i];return new Point(p.X-2-p.Z*.12,-p.Y+4+p.Z*.16);}
    protected override void OnRender(DrawingContext dc){if(shape==null)return;for(int i=3;i>=1;i--){dc.PushTransform(new TranslateTransform(i,i));dc.DrawGeometry(new SolidColorBrush(Color.FromArgb(10,24,16,10)),null,shape);dc.Pop();}dc.DrawGeometry(new SolidColorBrush(Color.FromArgb(65,24,16,10)),null,shape);}
}
}

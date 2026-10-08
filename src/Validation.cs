using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Media.Media3D;
using System.Windows.Threading;
namespace DesktopRug {
static class Validation {
    internal static int Intersections(Cloth cloth){
        int size=cloth.Points.Length;var points=new Point3D[size*2];for(int i=0;i<size;i++){points[i]=cloth.Points[i]+cloth.Normals[i]*Cloth.HalfThickness;points[i+size]=cloth.Points[i]-cloth.Normals[i]*Cloth.HalfThickness;}
        var triangles=new List<int[]>();for(int side=0;side<2;side++)for(int j=0;j<Cloth.NY;j++)for(int i=0;i<Cloth.NX;i++){int n=j*(Cloth.NX+1)+i+side*size;triangles.Add(new[]{n,n+1,n+Cloth.NX+1});triangles.Add(new[]{n+1,n+Cloth.NX+2,n+Cloth.NX+1});}
        var grid=new Dictionary<string,List<int>>();int count=0;
        for(int t=0;t<triangles.Count;t++){
            var ids=triangles[t];var ps=ids.Select(i=>points[i]).ToArray();
            int x0=(int)Math.Floor(ps.Min(p=>p.X)/40),x1=(int)Math.Floor(ps.Max(p=>p.X)/40),y0=(int)Math.Floor(ps.Min(p=>p.Y)/40),y1=(int)Math.Floor(ps.Max(p=>p.Y)/40),z0=(int)Math.Floor(ps.Min(p=>p.Z)/40),z1=(int)Math.Floor(ps.Max(p=>p.Z)/40);
            var tested=new HashSet<int>();
            for(int x=x0;x<=x1;x++)for(int y=y0;y<=y1;y++)for(int z=z0;z<=z1;z++){
                string key=x+","+y+","+z;List<int> nearby;if(!grid.TryGetValue(key,out nearby)){nearby=new List<int>();grid[key]=nearby;}
                foreach(int other in nearby){if(!tested.Add(other))continue;var q=triangles[other];if(ids.Any(i=>q.Contains(i)))continue;var qs=q.Select(i=>points[i]).ToArray();bool hit=false;for(int e=0;e<3&&!hit;e++)hit=Crosses(ps[e],ps[(e+1)%3],qs[0],qs[1],qs[2])||Crosses(qs[e],qs[(e+1)%3],ps[0],ps[1],ps[2]);if(hit)count++;}
                nearby.Add(t);
            }
        }return count;
    }
    static bool Crosses(Point3D from,Point3D to,Point3D a,Point3D b,Point3D c){
        Vector3D d=to-from,e1=b-a,e2=c-a,h=Vector3D.CrossProduct(d,e2);double det=Vector3D.DotProduct(e1,h);if(Math.Abs(det)<1e-7)return false;double f=1/det;Vector3D s=from-a;double u=f*Vector3D.DotProduct(s,h);if(u<1e-5||u>1-1e-5)return false;var q=Vector3D.CrossProduct(s,e1);double v=f*Vector3D.DotProduct(d,q);if(v<1e-5||u+v>1-1e-5)return false;double t=f*Vector3D.DotProduct(e2,q);return t>1e-5&&t<1-1e-5;
    }
    internal static void PumpUntil(Func<bool> done,int milliseconds){
        var clock=Stopwatch.StartNew();while(!done()&&clock.ElapsedMilliseconds<milliseconds){var frame=new DispatcherFrame();Dispatcher.CurrentDispatcher.BeginInvoke(DispatcherPriority.Background,(Action)(()=>frame.Continue=false));Dispatcher.PushFrame(frame);Thread.Sleep(5);}if(!done())throw new Exception("Timed out after "+milliseconds+" ms");
    }
}
}

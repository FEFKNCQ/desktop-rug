using System;
using System.Collections.Generic;
using System.IO;
using System.Windows;
using System.Windows.Media.Media3D;

namespace DesktopRug {
// A developable, finite-radius fold. Arc length is preserved and the returning
// leaf is separated from the lower leaf by 2R. A drag adjusts one continuous
// fold instead of accumulating unstable, zero-thickness crumples.
sealed class Cloth {
    internal const int NX=64,NY=44;
    internal const double HalfThickness=2.8;
    internal readonly Point3D[] Points=new Point3D[(NX+1)*(NY+1)];
    internal readonly Vector3D[] Normals=new Vector3D[(NX+1)*(NY+1)];
    internal readonly RugState State;
    internal List<Rect> Icons=new List<Rect>();
    Vector foldNormal=new Vector(1,0);
    double crease,depth,targetDepth,grabProjection,initialDisplacement;
    Point grabStart;
    bool held;
    internal bool IsHeld {get{return held;}}
    internal double Height {get{return State.Width*2/3;}}
    internal double Radius {get{return Math.Max(15,Math.Min(23,State.Width*.028));}}
    internal double FoldDepth {get{return depth;}}
    internal Cloth(RugState state){State=state;Snap();}
    internal double SurfaceHeight(double x,double y){
        double h=0;
        foreach(var r in Icons){double xx=x-r.X-r.Width*.5,yy=y-r.Y-r.Height*.35;if(Math.Abs(xx)>75||Math.Abs(yy)>65)continue;double dx=xx/Math.Max(32,r.Width*.65),dy=yy/Math.Max(30,r.Height*.4);h+=3*Math.Exp(-(dx*dx+dy*dy)*1.5);}
        return 5.6+Math.Min(12,h);
    }
    Point Local(Point p){double a=-State.Angle*Math.PI/180,c=Math.Cos(a),s=Math.Sin(a),x=p.X-State.X,y=p.Y-State.Y;return new Point(x*c-y*s,x*s+y*c);}
    internal Point Screen(Point p){double a=State.Angle*Math.PI/180,c=Math.Cos(a),s=Math.Sin(a);return new Point(State.X+p.X*c-p.Y*s,State.Y+p.X*s+p.Y*c);}
    internal bool IsEdge(Point p){var q=Local(p);if(depth>.5){double along=q.X*foldNormal.X+q.Y*foldNormal.Y,across=-q.X*foldNormal.Y+q.Y*foldNormal.X;double back=crease+Math.PI*Radius-(along-crease);if(back>=crease+Math.PI*Radius&&InMaterial(back,across))return true;if(along>=crease&&along<=crease+Radius)return true;}return Math.Max(Math.Abs(q.X)/(State.Width*.5),Math.Abs(q.Y)/(Height*.5))>.64;}
    internal void Snap(){depth=targetDepth=0;held=false;Rebuild();}
    internal void UpdateTargets(){Rebuild();}
    internal void BeginGrip(Point p){
        grabStart=p;held=true;
        if(depth<.5){
            var q=Local(p);double x=q.X/(State.Width*.5),y=q.Y/(Height*.5);
            if(Math.Abs(x)>Math.Abs(y)*1.45)foldNormal=new Vector(Math.Sign(x),0);
            else if(Math.Abs(y)>Math.Abs(x)*1.45)foldNormal=new Vector(0,Math.Sign(y));
            else {foldNormal=new Vector(x,y);if(foldNormal.Length<.001)foldNormal=new Vector(1,0);foldNormal.Normalize();}
            grabProjection=(Math.Abs(foldNormal.X)*State.Width+Math.Abs(foldNormal.Y)*Height)*.5;
            depth=targetDepth=0;
        }
        initialDisplacement=Displacement(targetDepth);
    }
    double Displacement(double d){double r=Radius;return d<Math.PI*r?d-r*Math.Sin(d/r):2*d-Math.PI*r;}
    double DepthFor(double displacement){
        if(displacement<=0)return 0;double lo=0,hi=Math.Max(State.Width,Height)*1.5;
        for(int n=0;n<28;n++){double mid=(lo+hi)*.5;if(Displacement(mid)<displacement)lo=mid;else hi=mid;}return (lo+hi)*.5;
    }
    internal void MoveGrip(Point p){
        if(!held)return;Point a=Local(grabStart),b=Local(p);double drag=(a.X-b.X)*foldNormal.X+(a.Y-b.Y)*foldNormal.Y;
        double span=Math.Abs(foldNormal.X)*State.Width+Math.Abs(foldNormal.Y)*Height;
        targetDepth=Math.Min(span*.72,DepthFor(Math.Max(0,initialDisplacement+drag)));
    }
    internal void EndGrip(){held=false;}
    internal double Step(){return Step(1.0/60);}
    internal double Step(double seconds){
        double delta=targetDepth-depth;
        // Monotonic response: no spring overshoot or perpetual settling.
        depth+=delta*(1-Math.Exp(-Math.Min(.05,seconds)*24));
        if(Math.Abs(targetDepth-depth)<.025)depth=targetDepth;
        Rebuild();return Math.Abs(targetDepth-depth);
    }
    internal void Rebuild(){
        crease=grabProjection-depth;double r=Radius,a=State.Angle*Math.PI/180,c=Math.Cos(a),s=Math.Sin(a);
        for(int j=0;j<=NY;j++)for(int i=0;i<=NX;i++){
            double x=(i/(double)NX-.5)*State.Width,y=(j/(double)NY-.5)*Height;
            double q=x*foldNormal.X+y*foldNormal.Y-crease,z=0,theta=0;
            if(depth>.001&&q>0){theta=Math.Min(Math.PI,q/r);double projected=q<Math.PI*r?r*Math.Sin(theta):Math.PI*r-q;double shift=projected-q;x+=foldNormal.X*shift;y+=foldNormal.Y*shift;z=r*(1-Math.Cos(theta));}
            double sx=State.X+x*c-y*s,sy=State.Y+x*s+y*c;
            double ripple=depth>.1?1.6*Math.Sin((-x*foldNormal.Y+y*foldNormal.X)*.035)*Math.Exp(-Math.Abs(q)/(r*2.5))*Math.Min(1,depth/30):0;
            int n=j*(NX+1)+i;Points[n]=new Point3D(sx,-sy,SurfaceHeight(sx,sy)+z+ripple);
            double nx=-foldNormal.X*Math.Sin(theta),ny=-foldNormal.Y*Math.Sin(theta);
            Normals[n]=new Vector3D(nx*c-ny*s,-nx*s-ny*c,Math.Cos(theta));
        }
        // Include drape over icons and the soft crease in lighting and thickness.
        for(int j=0;j<=NY;j++)for(int i=0;i<=NX;i++){
            int n=j*(NX+1)+i,left=j*(NX+1)+Math.Max(0,i-1),right=j*(NX+1)+Math.Min(NX,i+1),up=Math.Max(0,j-1)*(NX+1)+i,down=Math.Min(NY,j+1)*(NX+1)+i;
            var normal=Vector3D.CrossProduct(Points[right]-Points[left],Points[up]-Points[down]);if(normal.LengthSquared>.00001){normal.Normalize();Normals[n]=normal;}
        }
    }
    internal void TranslateInstant(double dx,double dy){State.X+=dx;State.Y+=dy;for(int i=0;i<Points.Length;i++)Points[i]+=new Vector3D(dx,-dy,0);grabStart+=new Vector(dx,dy);}
    internal void Transform(double scale,double degrees){State.Width*=scale;State.Angle+=degrees;depth*=scale;targetDepth*=scale;grabProjection*=scale;Rebuild();}
    internal double MaximumStretch(){double max=0,dx=State.Width/NX,dy=Height/NY;for(int j=0;j<=NY;j++)for(int i=0;i<=NX;i++){int n=j*(NX+1)+i;if(i<NX)max=Math.Max(max,(Points[n+1]-Points[n]).Length/dx);if(j<NY)max=Math.Max(max,(Points[n+NX+1]-Points[n]).Length/dy);}return max;}
    internal void SaveShape(){try{using(var w=new BinaryWriter(File.Create(Path.Combine(Program.Root,"cloth-shape.bin")))){w.Write(4);w.Write(foldNormal.X);w.Write(foldNormal.Y);w.Write(grabProjection);w.Write(targetDepth);}}catch(Exception ex){Program.Log(ex.Message);}}
    internal void LoadShape(){try{using(var r=new BinaryReader(File.OpenRead(Path.Combine(Program.Root,"cloth-shape.bin")))){if(r.ReadInt32()!=4)return;var normal=new Vector(r.ReadDouble(),r.ReadDouble());double p=r.ReadDouble(),d=r.ReadDouble();if(double.IsNaN(p)||double.IsInfinity(p)||double.IsNaN(d)||double.IsInfinity(d)||d<0||d>State.Width*1.3||Math.Abs(normal.Length-1)>.001)return;foldNormal=normal;grabProjection=p;depth=targetDepth=d;Rebuild();}}catch{}}
    // Constant-cost hit testing, including the lower leaf, round bend and return.
    internal bool Contains(Point p){
        Point q=Local(p);if(depth<.001)return InRect(q.X,q.Y);
        double along=q.X*foldNormal.X+q.Y*foldNormal.Y,across=-q.X*foldNormal.Y+q.Y*foldNormal.X;
        if(along<=crease&&InMaterial(along,across))return true;
        double v=(along-crease)/Radius;
        if(v>=0&&v<=1){double angle=Math.Asin(v);if(InMaterial(crease+angle*Radius,across)||InMaterial(crease+(Math.PI-angle)*Radius,across))return true;}
        double back=crease+Math.PI*Radius-(along-crease);
        return back>=crease+Math.PI*Radius&&InMaterial(back,across);
    }
    internal bool ContainsLower(Point p){var q=Local(p);return InRect(q.X,q.Y)&&(depth<.001||q.X*foldNormal.X+q.Y*foldNormal.Y<crease);}
    bool InMaterial(double along,double across){return InRect(along*foldNormal.X-across*foldNormal.Y,along*foldNormal.Y+across*foldNormal.X);}
    bool InRect(double x,double y){return Math.Abs(x)<=State.Width*.5&&Math.Abs(y)<=Height*.5;}
}
}

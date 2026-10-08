using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace DesktopRug {
sealed partial class DesktopIcons {
    [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern IntPtr SendMessageTimeout(IntPtr window,uint message,IntPtr wp,IntPtr lp,uint flags,uint timeout,out IntPtr result);
    [DllImport("user32.dll")]static extern bool PostMessage(IntPtr window,uint message,IntPtr wp,IntPtr lp);
    [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")]static extern IntPtr WindowStyle(IntPtr window,int index);
    IntPtr liveWindow;int liveCount;bool stableIds;
    internal int LiveBatches,ShellBatches;internal readonly List<double> LiveTimes=new List<double>();
    static bool Message(IntPtr window,uint message,int wp,int lp,out int result){IntPtr value;bool ok=SendMessageTimeout(window,message,new IntPtr(wp),new IntPtr(lp),2,40,out value)!=IntPtr.Zero;result=unchecked((int)value.ToInt64());return ok;}
    void ReadLiveView(int count){liveWindow=Native.FindWindowEx(Native.DesktopView(),IntPtr.Zero,"SysListView32",null);int actual;liveCount=count;
        if(liveWindow==IntPtr.Zero||!Message(liveWindow,0x1004,0,0,out actual)||actual!=count){liveWindow=IntPtr.Zero;return;}
        stableIds=(WindowStyle(liveWindow,-16).ToInt64()&0x1000)==0;
    }
    int LiveId(int index){int id;return stableIds&&liveWindow!=IntPtr.Zero&&Message(liveWindow,0x10B4,index,0,out id)?id:-1;}
    bool SameItem(int index,byte[] expected){IntPtr pidl;if(Slot<GetItem>(6)(view,index,out pidl)<0||pidl==IntPtr.Zero)return false;try{if(ILGetSize(pidl)!=expected.Length)return false;var actual=new byte[expected.Length];Marshal.Copy(pidl,actual,0,actual.Length);for(int n=0;n<expected.Length;n++)if(actual[n]!=expected[n])return false;return true;}finally{Marshal.FreeCoTaskMem(pidl);}}
    internal bool MoveLive(List<Item> items,List<Native.POINT> positions){
        var timer=Stopwatch.StartNew();bool fast=false;
        try{fast=TryMoveLive(items,positions);if(fast)LiveBatches++;else{ShellBatches++;Move(items,positions);}return fast;}
        finally{LiveTimes.Add(timer.Elapsed.TotalMilliseconds);if(LiveTimes.Count>1000)LiveTimes.RemoveAt(0);}
    }
    bool TryMoveLive(List<Item> items,List<Native.POINT> positions){
        int count;if(liveWindow==IntPtr.Zero||!Native.IsWindow(liveWindow)||!Message(liveWindow,0x1004,0,0,out count)||count!=liveCount)return false;
        var indexes=new int[items.Count];
        for(int n=0;n<items.Count;n++){
            var item=items[n];var p=positions[n];if(p.X<0||p.Y<0||p.X>32767||p.Y>32767)return false;
            int index=item.ViewIndex;if(item.LiveKey>=0){if(!Message(liveWindow,0x10B5,item.LiveKey,0,out index)||index<0)return false;}
            // Explorer may use an owner-data view without stable control IDs.
            // Validate its current shell PIDL before using an enumerated index.
            if(item.LiveKey<0&&!SameItem(index,item.Id))return false;indexes[n]=index;
        }
        // Queue one burst so Explorer can paint the entire pile once. A send
        // for every icon lets paint run between items and becomes slow in piles.
        for(int n=0;n<items.Count;n++){var p=positions[n];if(!PostMessage(liveWindow,0x100F,new IntPtr(indexes[n]),new IntPtr((p.Y<<16)|(p.X&0xffff))))return false;}
        var last=items[items.Count-1];var target=positions[positions.Count-1];IntPtr pidl=Marshal.AllocCoTaskMem(last.Id.Length);bool applied=false;
        try{Marshal.Copy(last.Id,0,pidl,last.Id.Length);var deadline=Stopwatch.StartNew();
            do{System.Threading.Thread.Yield();Native.POINT actual;if(Slot<Position>(11)(view,pidl,out actual)>=0&&actual.X==target.X&&actual.Y==target.Y){applied=true;break;}}while(deadline.ElapsedMilliseconds<40);
        }finally{Marshal.FreeCoTaskMem(pidl);}
        if(!applied)return false;
        for(int n=0;n<items.Count;n++)items[n].Position=positions[n];
        return true;
    }
    internal object LiveStats(){int count;Message(liveWindow,0x1004,0,0,out count);return new{liveBatches=LiveBatches,shellBatches=ShellBatches,stableIds=stableIds,viewCount=count,cachedCount=liveCount,samples=LiveTimes.ToArray()};}
}
}

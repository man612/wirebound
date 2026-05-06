import React, { useMemo } from 'react';

interface TrafficChartProps {
  data: Array<{ time: string; upload: number; download: number }>;
}

const TrafficChart: React.FC<TrafficChartProps> = ({ data }) => {
  const width = 800; 
  const height = 120;

  const maxVal = useMemo(() => {
    if (data.length === 0) return 100;
    const max = Math.max(...data.map(d => Math.max(d.download, d.upload)));
    return max < 100 ? 100 : max;
  }, [data]);

  const getPoints = (type: 'download' | 'upload') => {
    if (data.length < 2) return '';
    return data.map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (d[type] / maxVal) * height;
      return `${x},${y}`;
    }).join(' ');
  };

  const pointsDown = getPoints('download');
  const pointsUp = getPoints('upload');

  return (
    <div className="w-full h-[120px] bg-bg-primary border border-border-subtle relative overflow-hidden flex flex-col theme-transition rounded-sm group cursor-crosshair">
      <div className="absolute top-2 right-2 flex gap-3 text-[10px] font-mono z-10 bg-bg-surface/90 px-2 py-1 border border-border-subtle rounded-sm backdrop-blur-sm transition-all duration-300 opacity-80 group-hover:opacity-100">
        <div className="flex items-center gap-1 text-accent-green">
          <div className="w-1.5 h-1.5 bg-accent-green rounded-full animate-pulse"></div> RX
        </div>
        <div className="flex items-center gap-1 text-accent-blue">
          <div className="w-1.5 h-1.5 bg-accent-blue rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div> TX
        </div>
      </div>
      
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full">
        {/* Grid lines */}
        <line x1="0" y1={height/2} x2={width} y2={height/2} className="stroke-border-subtle theme-transition" strokeDasharray="2 2" strokeWidth="1" />
        <line x1="0" y1={height/4} x2={width} y2={height/4} className="stroke-border-subtle theme-transition" strokeOpacity="0.5" strokeWidth="1" />
        <line x1="0" y1={(height/4)*3} x2={width} y2={(height/4)*3} className="stroke-border-subtle theme-transition" strokeOpacity="0.5" strokeWidth="1" />

        
        {/* TX (Up) */}
        {pointsUp && (
          <>
            <path d={`M 0,${height} L ${pointsUp} L ${width},${height} Z`} fill="rgba(59, 130, 246, 0.1)" style={{ transition: 'd 0.3s ease-out' }} />
            <polyline fill="none" className="stroke-blue-500" strokeWidth="1.5" points={pointsUp} strokeLinejoin="miter" style={{ transition: 'points 0.3s ease-out' }} />
          </>
        )}
        
        {/* RX (Down) */}
        {pointsDown && (
          <>
            <path d={`M 0,${height} L ${pointsDown} L ${width},${height} Z`} fill="rgba(16, 185, 129, 0.1)" style={{ transition: 'd 0.3s ease-out' }} />
            <polyline fill="none" className="stroke-emerald-500" strokeWidth="1.5" points={pointsDown} strokeLinejoin="miter" style={{ transition: 'points 0.3s ease-out' }} />
          </>
        )}
      </svg>
    </div>
  );
};

export default TrafficChart;

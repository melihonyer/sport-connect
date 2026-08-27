// Lazy-loaded chart component — recharts sadece bu chunk'ta yüklenir
import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const ActivityChart = ({ activityData, activityMeta, t }) => {
  return (
    <>
      {/* Haftalık özet */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { val: activityMeta.weekTotal, label: t("activity.weekTrainings") },
          { val: activityData.filter(d => d.count > 0).length, label: t("activity.activeDays") },
          { val: activityMeta.streak, label: t("activity.currentStreak") },
        ].map((s, i) => (
          <div key={i} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100 text-center">
            <div className="text-lg font-bold text-slate-800">{s.val}</div>
            <div className="text-[10px] text-slate-400 font-medium mt-0.5 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bar grafik */}
      <div className="rounded-xl overflow-hidden">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={activityData} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
            <XAxis dataKey="day" tick={{fill:"#94a3b8", fontSize:11, fontWeight:600}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:"#94a3b8", fontSize:10}} axisLine={false} tickLine={false} allowDecimals={false} width={20}/>
            <Tooltip
              cursor={{fill:"rgba(17,73,86,0.06)", radius:8}}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-left min-w-[140px]">
                    <div className="text-xs font-bold text-slate-700 mb-1.5">{d.day} — {d.count} {t("activity.tooltipTrainings")}</div>
                    {d.trainings?.length > 0 && d.trainings.map((tr, i) => (
                      <div key={i} className="text-xs text-slate-500 flex items-center gap-1.5 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0"/>
                        <span className="truncate max-w-[120px]">{tr.title}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Bar dataKey="count" radius={[6,6,0,0]}
              fill="url(#pgrd)"
              shape={(props) => {
                const { x, y, width, height, payload } = props;
                const isToday = payload?.isToday;
                const isEmpty = payload?.count === 0;
                return (
                  <g>
                    <rect
                      x={x} y={isEmpty ? y + height - 4 : y}
                      width={width} height={isEmpty ? 4 : height}
                      rx={6} ry={6}
                      fill={isEmpty ? (isToday ? "rgba(17,73,86,0.15)" : "#f1f5f9") : "url(#pgrd)"}
                      opacity={isToday && !isEmpty ? 1 : isEmpty ? 1 : 0.85}
                    />
                    {isToday && !isEmpty && (
                      <rect x={x + width/2 - 2} y={y - 7} width={4} height={4} rx={2} fill="#114956"/>
                    )}
                  </g>
                );
              }}
            />
            <defs>
              <linearGradient id="pgrd" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#114956" stopOpacity={1}/>
                <stop offset="100%" stopColor="#0e3c47" stopOpacity={0.75}/>
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {activityMeta.weekTotal === 0 && (
        <p className="text-center text-xs text-slate-400 mt-2">{t("activity.noActivityYet")}</p>
      )}
    </>
  );
};

export default ActivityChart;

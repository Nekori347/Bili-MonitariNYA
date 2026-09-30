import type { FieldVisibility } from "../../types/settings";

/**
 * "成品 Preview 映射开关": a scaled-down replica of the profile card where each
 * element IS its own switch. Clicking a region flips that field, so the settings
 * page never shows a wall of separate switches.
 *
 * Elements are laid out side by side (rather than overlapping as in the real
 * card) so every zone stays independently clickable.
 */
function Zone({
  field,
  fields,
  onToggle,
  children,
}: {
  field: keyof FieldVisibility;
  fields: FieldVisibility;
  onToggle: (k: keyof FieldVisibility, v: boolean) => void;
  children: React.ReactNode;
}) {
  const on = fields[field];
  return (
    <span
      className={`pz${on ? "" : " off"}`}
      title={`${on ? "点击隐藏" : "点击显示"}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(field, !on);
      }}
    >
      {children}
      <span className="pz-badge">{on ? "✓" : "✕"}</span>
    </span>
  );
}

export function PreviewCard({
  fields,
  onToggle,
}: {
  fields: FieldVisibility;
  onToggle: (k: keyof FieldVisibility, v: boolean) => void;
}) {
  const z = (field: keyof FieldVisibility, node: React.ReactNode) => (
    <Zone field={field} fields={fields} onToggle={onToggle}>{node}</Zone>
  );

  return (
    <div className="pz-scope flex flex-col rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
      {/* banner strip */}
      <div className="flex items-center gap-2 px-2 py-1.5" style={{ background: "linear-gradient(135deg, #fb729955, #4ac7ff44)" }}>
        {z("banner", <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--text-2)" }}>Banner</span>)}
        <span className="flex-1" />
        {z("decoration", <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--text-2)" }}>装扮编号</span>)}
      </div>

      {/* avatar row */}
      <div className="flex items-center gap-2 px-2 pt-2">
        {z("avatar", <span className="block rounded-full" style={{ width: 30, height: 30, background: "var(--surface-2)", border: "2px solid var(--bg)" }} />)}
        {z("pendant", <span className="block rounded-full" style={{ width: 30, height: 30, border: "2px dashed #fb7299" }} />)}
        {z("official", <span className="block rounded-full text-center" style={{ width: 16, height: 16, background: "#FFC62E", color: "#fff", fontSize: 10, lineHeight: "16px" }}>⚡</span>)}
        {z("level", <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: "#F04C49", color: "#fff" }}>LV6</span>)}
      </div>

      {/* identity */}
      <div className="flex flex-col gap-1 px-2 pt-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {z("name", <span className="text-[11.5px] font-semibold px-1 rounded" style={{ background: "var(--surface)", color: "var(--text)" }}>用户名 / 备注</span>)}
          {z("sex", <span className="rounded-full" style={{ width: 13, height: 13, background: "#FB7299", display: "inline-block" }} />)}
          {z("vip", <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: "#FB7299", color: "#fff" }}>年度大会员</span>)}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {z("uid", <span className="text-[10px] px-1 rounded" style={{ background: "var(--surface)", color: "var(--text-2)" }}>UID 17409970</span>)}
          {z("fansMedal", <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: "linear-gradient(90deg,#B8C7D0,#A2A7B0)", color: "#fff" }}>巡天者 21</span>)}
          {z("nameplate", <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>有爱大佬</span>)}
        </div>
        {z("sign", <span className="block text-[10px] truncate" style={{ color: "var(--text-2)" }}>这里显示 UP 主简介</span>)}
      </div>

      {/* stats */}
      <div className="grid grid-cols-5 gap-1 p-2 mt-2" style={{ background: "var(--surface-2)" }}>
        {z("following", <span className="pz-stat">关注<b>2676</b></span>)}
        {z("follower", <span className="pz-stat">粉丝<b>1.1万</b></span>)}
        {z("likes", <span className="pz-stat">获赞<b>3353万</b></span>)}
        {z("totalViews", <span className="pz-stat">播放<b>2.2亿</b></span>)}
        {z("videoCount", <span className="pz-stat">投稿<b>98</b></span>)}
      </div>

      {/* growth */}
      <div className="grid grid-cols-3 gap-1 px-2 py-1.5" style={{ background: "var(--surface-2)", borderTop: "1px solid var(--line)" }}>
        {z("growthDay", <span className="pz-stat">日增长<b>+20</b></span>)}
        {z("growthWeek", <span className="pz-stat">周增长<b>+120</b></span>)}
        {z("growthMonth", <span className="pz-stat">月增长<b>+800</b></span>)}
      </div>
    </div>
  );
}

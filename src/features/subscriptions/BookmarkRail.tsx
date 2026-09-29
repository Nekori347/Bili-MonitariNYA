import { useUIStore } from "../../store/uiStore";
import { markUnread } from "../../services/database/subscriptions";
import type { Subscription } from "../../services/database/subscriptions";
import { useFaces } from "../../queries/brief";
import { Avatar } from "./Avatar";
import { ChevronRight } from "../../components/ui/Icons";

/**
 * Collapsed sidebar. The glass panel shifts right and this strip — transparent,
 * showing whatever is behind the window — fills the space to its left, so the
 * bookmarks read as sitting outside the app window, hanging off the rail.
 */
export function BookmarkRail({ subs }: { subs: Subscription[] }) {
  const selectedMid = useUIStore((s) => s.selectedMid);
  const setSelectedMid = useUIStore((s) => s.setSelectedMid);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const faces = useFaces(subs);

  return (
    <div className="bm-gutter">
      <div className="bm-list">
        {subs.map((sub) => (
          <div key={sub.mid} className="bm-item">
            <button
              className="bm-tab"
              style={selectedMid === sub.mid ? { borderColor: "color-mix(in srgb, var(--accent) 55%, var(--line))" } : undefined}
              onClick={() => {
                setSelectedMid(sub.mid);
                if (sub.hasUnreadUpdate) void markUnread(sub.mid, false);
              }}
            >
              <span className="bm-text">
                <span className="bm-text-1">{sub.remark || sub.name || `UID ${sub.mid}`}</span>
                <span className="bm-text-2">{sub.remark ? `${sub.name} · ` : ""}UID {sub.mid}</span>
              </span>
              <span className="bm-avatar">
                <Avatar mid={sub.mid} face={faces[sub.mid]} name={sub.name} size={20} />
              </span>
              {sub.hasUnreadUpdate && <span className="bm-dot" />}
            </button>
          </div>
        ))}
      </div>

      <div className="bm-rail">
        <span className="bm-grip"><i /><i /></span>
        <button className="bm-chev" title="展开侧栏" onClick={toggleSidebar}>
          <ChevronRight size={11} />
        </button>
        <span className="bm-grip"><i /><i /></span>
      </div>
    </div>
  );
}

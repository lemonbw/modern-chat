import type { InfoTab } from "../../../features/contacts/model/chatInfo";
import { tabLabel } from "../model/infoLabels";

export const InfoTabs = ({ tabs, activeTab, onSelect }: { tabs: InfoTab[]; activeTab: InfoTab; onSelect: (tab: InfoTab) => void }) => (
  <nav className="flex gap-1 overflow-x-auto border-b border-[#202d39] px-3 pt-2 pb-[9px]">
    {tabs.map((tab) => (
      <button
        key={tab}
        className={`shrink-0 rounded-full border-0 px-3 py-[6px] text-xs ${activeTab === tab ? "bg-[#2b3b49] font-semibold text-[#54bcf1]" : "bg-transparent text-[#99a8b5] hover:text-white"}`}
        onClick={() => onSelect(tab)}
      >
        {tabLabel[tab]}
      </button>
    ))}
  </nav>
);

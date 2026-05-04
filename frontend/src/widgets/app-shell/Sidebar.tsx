import { cn } from '@/shared/lib/utils';
import { Icon, type IconName } from '@/shared/ui/atoms/Icon';
import { Dot } from '@/shared/ui/atoms/Dot';

export interface SidebarProps {
  active?: IconName;
}

const topIcons: IconName[] = ['user', 'bot', 'spark', 'book', 'grid', 'flow', 'msg'];
const bottomIcons: IconName[] = ['search', 'shield'];

export function Sidebar({ active }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex flex-col items-center shrink-0 self-stretch',
        'w-[56px] bg-[var(--dark-bg)]'
      )}
    >
      <div className="flex flex-col items-center w-full">
        {topIcons.map((icon) => (
          <NavItem key={icon} icon={icon} isActive={active === icon} />
        ))}
      </div>

      <div className="flex-1 w-full border-t border-[var(--dark-line)]" />

      <div className="flex flex-col items-center w-full">
        {bottomIcons.map((icon) => (
          <NavItem key={icon} icon={icon} isActive={active === icon} />
        ))}
      </div>
    </aside>
  );
}

function NavItem({ icon, isActive }: { icon: IconName; isActive: boolean }) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center',
        'w-[56px] h-[56px] cursor-pointer',
        'hover:bg-[var(--dark-bg-2)]'
      )}
    >
      {isActive && (
        <div className="absolute left-[2px] top-1/2 -translate-y-1/2">
          <Dot tone="signal" size={6} />
        </div>
      )}
      <Icon
        name={icon}
        size={18}
        className={cn(isActive ? 'text-[var(--signal)]' : 'text-[var(--dark-ink)]')}
      />
    </div>
  );
}

import { NavLink } from 'react-router-dom';

export default function ItemDoMenu({ item, collapsed }) {
  const iconSize = collapsed ? 18 : 16;
  const title = collapsed ? item.label : undefined;
  const label = collapsed ? null : item.label;
  const alignment = collapsed ? 'justify-center' : '';

  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      title={title}
      className={({ isActive }) =>
        `flex items-center ${alignment} ${collapsed ? 'px-3' : 'gap-2 px-3'} py-2 rounded-lg mb-0.5 ${collapsed ? '' : 'text-sm'} transition-colors ${
          isActive ? 'bg-gradient-to-b from-brand-600 to-brand-700 text-white' : 'text-brand-800 hover:bg-brand-100 hover:text-brand-900'
        }`
      }
    >
      <item.icon size={iconSize} />
      {label}
    </NavLink>
  );
}

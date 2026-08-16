import { useState } from 'react';
import CabecalhoDaSidebar from './CabecalhoDaSidebar';
import { DEFAULT_ROUTE_ORDER, MODULE_MAP, menuSections } from './menu-secoes';
import { getVisibleSections } from './permissoes-do-menu';
import RodapeDaSidebar from './RodapeDaSidebar';
import SecaoDoMenu from './SecaoDoMenu';

export { DEFAULT_ROUTE_ORDER, MODULE_MAP };

export default function NavigationSidebar({
  user,
  permissions,
  isMobile,
  sidebarOpen,
  setSidebarOpen,
  onLogout,
}) {
  const [collapsedSections, setCollapsedSections] = useState({});

  const toggleSection = (label) => {
    setCollapsedSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const visibleSections = getVisibleSections(menuSections, permissions);

  return (
    <aside className={`${isMobile
      ? `fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
      : `${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300`
    } bg-gradient-to-b from-white to-brand-50 text-brand-900 border-r border-brand-100 flex flex-col overflow-y-auto`}>
      <CabecalhoDaSidebar
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      <nav className="flex-1 p-2">
        {visibleSections.map(section => (
          <SecaoDoMenu
            key={section.label}
            section={section}
            permissions={permissions}
            sidebarOpen={sidebarOpen}
            collapsedSections={collapsedSections}
            toggleSection={toggleSection}
          />
        ))}
      </nav>
      <RodapeDaSidebar user={user} sidebarOpen={sidebarOpen} onLogout={onLogout} />
    </aside>
  );
}

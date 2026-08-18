import { MODULE_MAP } from './menu-secoes';

export function getVisibleItems(section, permissions) {
  return section.items.filter((item) => {
    const module = MODULE_MAP[item.path];
    return !module || !permissions || permissions[module];
  });
}

export function getVisibleSections(sections, permissions) {
  return sections
    .map(section => ({ ...section, items: getVisibleItems(section, permissions) }))
    .filter(section => section.items.length > 0);
}

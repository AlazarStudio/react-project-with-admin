/**
 * Все иконки из Lucide React для блока «Что взять с собой».
 * Группировка по категориям для удобного выбора.
 */
import { icons } from 'lucide-react';

export const MUI_ICONS = icons;

export const MUI_ICON_NAMES = Object.keys(MUI_ICONS).sort();

export function getMuiIconComponent(name) {
  return MUI_ICONS[name] || null;
}

/**
 * Группы иконок: ключевые слова для отнесения иконки к группе (по имени, без учёта регистра).
 * Порядок групп определяет порядок отображения.
 */
const GROUP_KEYWORDS = [
  { id: 'weather', label: 'Погода и природа', keywords: ['Sun', 'Moon', 'Cloud', 'Rain', 'Snow', 'Wind', 'Storm', 'Thermometer', 'Umbrella', 'Droplet', 'Flame', 'Leaf', 'Tree', 'Trees', 'Flower', 'Mountain', 'MountainSnow', 'Waves', 'Fish', 'Bird', 'Bug', 'Sprout', 'Eco'] },
  { id: 'clothing', label: 'Одежда и аксессуары', keywords: ['Shirt', 'Glasses', 'Watch', 'Hat', 'Scarf', 'Sunglasses', 'Checkroom', 'Footprints', 'Shoe'] },
  { id: 'food', label: 'Еда и напитки', keywords: ['Utensils', 'Coffee', 'Apple', 'Pizza', 'Salad', 'Cookie', 'Cake', 'Wine', 'Beer', 'CupSoda', 'ChefHat', 'CookingPot', 'IceCream', 'Sandwich', 'Milk'] },
  { id: 'health', label: 'Здоровье и медицина', keywords: ['Heart', 'Pill', 'Hospital', 'Stethoscope', 'Syringe', 'Bandage', 'FirstAid', 'HeartPulse', 'Activity', 'Brain', 'Bone'] },
  { id: 'sport', label: 'Спорт и активность', keywords: ['Bike', 'Run', 'Dumbbell', 'Tennis', 'Skiing', 'Hiking', 'Swim', 'Footprints', 'Fitness', 'Medal', 'Trophy', 'Target'] },
  { id: 'transport', label: 'Транспорт', keywords: ['Car', 'Plane', 'Ship', 'Bike', 'Bus', 'Train', 'Fuel', 'Navigation', 'Compass', 'MapPin', 'Map'] },
  { id: 'travel', label: 'Путешествия и отдых', keywords: ['Backpack', 'Tent', 'Compass', 'Map', 'Camera', 'Luggage', 'Landmark', 'Palmtree', 'Beach', 'Sailboat', 'Campfire'] },
  { id: 'tech', label: 'Электроника и гаджеты', keywords: ['Phone', 'Camera', 'Battery', 'Wifi', 'Bluetooth', 'Laptop', 'Smartphone', 'Flashlight', 'Plug'] },
  { id: 'tools', label: 'Инструменты и предметы', keywords: ['Wrench', 'Hammer', 'Scissors', 'Ruler', 'Pen', 'Book', 'Key', 'Lock', 'Lightbulb', 'Lamp'] },
];

function matchGroup(name, keywords) {
  const lower = name.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Возвращает массив групп: { id, label, iconNames }.
 * Иконки, не попавшие ни в одну группу, попадают в «Прочее».
 */
export function getIconGroups() {
  const used = new Set();
  const groups = GROUP_KEYWORDS.map(({ id, label, keywords }) => {
    const iconNames = MUI_ICON_NAMES.filter((name) => {
      if (!matchGroup(name, keywords)) return false;
      used.add(name);
      return true;
    });
    return { id, label, iconNames };
  });

  const otherNames = MUI_ICON_NAMES.filter((name) => !used.has(name));
  if (otherNames.length > 0) {
    groups.push({ id: 'other', label: 'Прочее', iconNames: otherNames });
  }

  return groups;
}

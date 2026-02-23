/**
 * Маппинг категорий услуг (из админки) на ключ шаблона.
 * Используется для выбора компонента детальной страницы по типу услуги.
 */
export const CATEGORY_TO_TEMPLATE_KEY = {
  'Гид': 'guide',
  'Активности': 'activities',
  'Прокат оборудования': 'equipment-rental',
  'Пункты придорожного сервиса': 'roadside-service',
  'Торговые точки': 'shop',
  'Сувениры': 'souvenirs',
  'Гостиница': 'hotel',
  'Кафе и ресторан': 'cafe',
  'Трансфер': 'transfer',
  'АЗС': 'gas-station',
  'Санитарные узлы': 'toilets',
  'Пункт медпомощи': 'medical',
  'МВД': 'police',
  'Пожарная охрана': 'fire',
  'Туроператор': 'tour-operator',
  'Торговая точка': 'shop',
  'Придорожный пункт': 'roadside-point',
  'Музей': 'museum',
}

/** Ключ шаблона по умолчанию, если категория не найдена */
export const DEFAULT_TEMPLATE_KEY = 'guide'

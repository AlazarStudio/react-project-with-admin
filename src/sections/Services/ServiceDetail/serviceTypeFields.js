/**
 * Схема полей шаблона по типу услуги для формы в админке.
 * key — ключ в data; label — подпись в форме; type — тип контрола.
 */
export const SERVICE_TYPE_FIELDS = {
  guide: [
    { key: 'aboutContent', label: 'О специалисте (описание)', type: 'richtext' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
    { key: 'pricesInData', label: 'Услуги и цены (название — цена)', type: 'priceList' },
    { key: 'certificatesInData', label: 'Сертификаты и документы', type: 'certificateList' },
  ],
  activities: [
    { key: 'aboutContent', label: 'О активности (описание)', type: 'richtext' },
    { key: 'tags', label: 'Критерии активности (название — значение)', type: 'titleTextList' },
    { key: 'programSteps', label: 'Программа (название — описание)', type: 'titleTextList' },
    { key: 'equipmentList', label: 'Что взять с собой (название — примечание)', type: 'titleTextList' },
    { key: 'requirementsList', label: 'Требования к участникам (название — описание)', type: 'titleTextList' },
    { key: 'safetyNotes', label: 'Безопасность и организация (текст)', type: 'richtext' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
  ],
  'equipment-rental': [
    { key: 'aboutContent', label: 'О прокате (описание)', type: 'richtext' },
    { key: 'criteriaList', label: 'Критерии проката (каждый пункт отдельно)', type: 'tagList' },
    { key: 'equipmentItems', label: 'Каталог оборудования', type: 'equipmentList' },
    { key: 'conditions', label: 'Условия проката (каждый пункт отдельно)', type: 'tagList' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
  ],
  'roadside-service': [
    { key: 'aboutContent', label: 'О сервисе (описание)', type: 'richtext' },
    { key: 'criteriaList', label: 'Критерии (каждый пункт отдельно)', type: 'tagList' },
    { key: 'servicesList', label: 'Услуги (каждый пункт отдельно)', type: 'tagList' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
  ],
  'roadside-point': [
    { key: 'aboutContent', label: 'О пункте (описание)', type: 'richtext' },
    { key: 'criteriaList', label: 'Критерии (каждый пункт отдельно)', type: 'tagList' },
    { key: 'servicesList', label: 'Услуги (каждый пункт отдельно)', type: 'tagList' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
  ],
  shop: [
    { key: 'aboutContent', label: 'О магазине (описание)', type: 'richtext' },
    { key: 'criteriaList', label: 'Критерии (каждый пункт отдельно)', type: 'tagList' },
    { key: 'assortment', label: 'Ассортимент (каждый пункт отдельно)', type: 'tagList' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
  ],
  souvenirs: [
    { key: 'aboutContent', label: 'О магазине (описание)', type: 'richtext' },
    { key: 'criteriaList', label: 'Критерии (каждый пункт отдельно)', type: 'tagList' },
    { key: 'products', label: 'Что продаём (каждый пункт отдельно)', type: 'tagList' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
  ],
  hotel: [
    { key: 'aboutContent', label: 'О гостинице (описание)', type: 'richtext' },
    { key: 'criteriaList', label: 'Критерии (каждый пункт отдельно)', type: 'tagList' },
    { key: 'roomTypes', label: 'Номера (название, цена, фото номера)', type: 'roomList' },
    { key: 'amenities', label: 'Удобства (каждый пункт отдельно)', type: 'tagList' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
  ],
  cafe: [
    { key: 'aboutContent', label: 'О заведении (описание)', type: 'richtext' },
    { key: 'criteriaList', label: 'Критерии (каждый пункт отдельно)', type: 'tagList' },
    { key: 'cuisineList', label: 'Услуги / кухня и меню (каждый пункт отдельно)', type: 'tagList' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
  ],
  transfer: [
    { key: 'aboutContent', label: 'О трансфере (описание)', type: 'richtext' },
    { key: 'criteriaList', label: 'Критерии (каждый пункт отдельно)', type: 'tagList' },
    { key: 'routesList', label: 'Направления (каждый пункт отдельно)', type: 'tagList' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
  ],
  'gas-station': [
    { key: 'aboutContent', label: 'Об АЗС (описание)', type: 'richtext' },
    { key: 'criteriaList', label: 'Критерии (каждый пункт отдельно)', type: 'tagList' },
    { key: 'servicesList', label: 'Услуги (каждый пункт отдельно)', type: 'tagList' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
  ],
  toilets: [
    { key: 'aboutContent', label: 'Об объекте (описание)', type: 'richtext' },
    { key: 'criteriaList', label: 'Критерии (каждый пункт отдельно)', type: 'tagList' },
    { key: 'conditions', label: 'Условия (каждый пункт отдельно)', type: 'tagList' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
  ],
  medical: [
    { key: 'aboutContent', label: 'О пункте (описание)', type: 'richtext' },
    { key: 'criteriaList', label: 'Критерии (каждый пункт отдельно)', type: 'tagList' },
    { key: 'howtoList', label: 'Как добраться (каждый пункт отдельно)', type: 'tagList' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
  ],
  police: [
    { key: 'aboutContent', label: 'Об отделении (описание)', type: 'richtext' },
    { key: 'criteriaList', label: 'Критерии (каждый пункт отдельно)', type: 'tagList' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
  ],
  fire: [
    { key: 'aboutContent', label: 'О подразделении (описание)', type: 'richtext' },
    { key: 'criteriaList', label: 'Критерии (каждый пункт отдельно)', type: 'tagList' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
  ],
  'tour-operator': [
    { key: 'aboutContent', label: 'О компании (описание)', type: 'richtext' },
    { key: 'criteriaList', label: 'Критерии (каждый пункт отдельно)', type: 'tagList' },
    { key: 'toursList', label: 'Туры и программы (каждый пункт отдельно)', type: 'tagList' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
  ],
  museum: [
    { key: 'aboutContent', label: 'О музее (описание)', type: 'richtext' },
    { key: 'criteriaList', label: 'Критерии (каждый пункт отдельно)', type: 'tagList' },
    { key: 'exhibitionsList', label: 'Экспозиции и выставки (каждый пункт отдельно)', type: 'tagList' },
    { key: 'collectionsList', label: 'Коллекции (каждый пункт отдельно)', type: 'tagList' },
    { key: 'workingHours', label: 'Режим работы (текст)', type: 'richtext' },
    { key: 'contacts', label: 'Контакты', type: 'contactList' },
  ],
}

/** Типы полей для формы */
export const FIELD_TYPES = {
  text: 'text',
  textarea: 'textarea',
  richtext: 'richtext',
  tags: 'tags',
  contactList: 'contactList',
  sectionList: 'sectionList',
  equipmentList: 'equipmentList',
  stringList: 'stringList',
  tagList: 'tagList',
  priceList: 'priceList',
  titleTextList: 'titleTextList',
  certificateList: 'certificateList',
  roomList: 'roomList',
}

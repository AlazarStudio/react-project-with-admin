/**
 * Иконки Material UI для групп фильтров маршрутов.
 * Ограниченный набор для выбора при создании группы.
 */
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import TerrainIcon from '@mui/icons-material/Terrain'
import StraightenIcon from '@mui/icons-material/Straighten'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom'
import NightlightRoundIcon from '@mui/icons-material/NightlightRound'
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import PlaceIcon from '@mui/icons-material/Place'
import MapIcon from '@mui/icons-material/Map'
import LandscapeIcon from '@mui/icons-material/Landscape'
import AcUnitIcon from '@mui/icons-material/AcUnit'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import FilterVintageIcon from '@mui/icons-material/FilterVintage'
import BeachAccessIcon from '@mui/icons-material/BeachAccess'
import BackpackIcon from '@mui/icons-material/Backpack'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import LocalHospitalIcon from '@mui/icons-material/LocalHospital'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import PetsIcon from '@mui/icons-material/Pets'
import GroupsIcon from '@mui/icons-material/Groups'
import StarIcon from '@mui/icons-material/Star'
import FlagIcon from '@mui/icons-material/Flag'
import CategoryIcon from '@mui/icons-material/Category'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'
import WaterDropIcon from '@mui/icons-material/WaterDrop'
import ParkIcon from '@mui/icons-material/Park'
import HikingIcon from '@mui/icons-material/Hiking'
import DownhillSkiingIcon from '@mui/icons-material/DownhillSkiing'
import SailingIcon from '@mui/icons-material/Sailing'
import KayakingIcon from '@mui/icons-material/Kayaking'
import ScaleIcon from '@mui/icons-material/Scale'
import StraightenOutlinedIcon from '@mui/icons-material/StraightenOutlined'

const ICONS = {
  AccessTime: AccessTimeIcon,
  Terrain: TerrainIcon,
  Straighten: StraightenIcon,
  TrendingUp: TrendingUpIcon,
  FamilyRestroom: FamilyRestroomIcon,
  NightlightRound: NightlightRoundIcon,
  DirectionsWalk: DirectionsWalkIcon,
  DirectionsCar: DirectionsCarIcon,
  DirectionsBike: DirectionsBikeIcon,
  CalendarMonth: CalendarMonthIcon,
  Place: PlaceIcon,
  Map: MapIcon,
  Landscape: LandscapeIcon,
  AcUnit: AcUnitIcon,
  WbSunny: WbSunnyIcon,
  FilterVintage: FilterVintageIcon,
  BeachAccess: BeachAccessIcon,
  Backpack: BackpackIcon,
  Restaurant: RestaurantIcon,
  LocalHospital: LocalHospitalIcon,
  CameraAlt: CameraAltIcon,
  Pets: PetsIcon,
  Groups: GroupsIcon,
  Star: StarIcon,
  Flag: FlagIcon,
  Category: CategoryIcon,
  InfoOutlined: InfoOutlinedIcon,
  CheckCircleOutline: CheckCircleOutlineIcon,
  FitnessCenter: FitnessCenterIcon,
  WaterDrop: WaterDropIcon,
  Park: ParkIcon,
  Hiking: HikingIcon,
  DownhillSkiing: DownhillSkiingIcon,
  Sailing: SailingIcon,
  Kayaking: KayakingIcon,
  Scale: ScaleIcon,
  StraightenOutlined: StraightenOutlinedIcon,
}

export const ROUTE_FILTER_ICON_NAMES = Object.keys(ICONS).sort()

export function getRouteFilterIcon(name) {
  if (!name || typeof name !== 'string') return null
  return ICONS[name.trim()] || null
}

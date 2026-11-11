import { revealCommand } from '../utils/opener'
import { handleOpenRequest } from '../utils/openRequest'

export default defineEventHandler((event) => handleOpenRequest(event, (path) => revealCommand(path)))

import { openCommand } from '../utils/opener'
import { handleOpenRequest } from '../utils/openRequest'

export default defineEventHandler((event) => handleOpenRequest(event, (path) => openCommand(path)))

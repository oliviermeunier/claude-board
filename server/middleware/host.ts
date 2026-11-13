import { isAllowedHost } from '../utils/host'

export default defineEventHandler((event) => {
  if (!isAllowedHost(getRequestHeader(event, 'host'))) {
    throw createError({ statusCode: 403, statusMessage: 'Host not allowed' })
  }
})

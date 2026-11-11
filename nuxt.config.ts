export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  features: {
    inlineStyles: false,
  },
  app: {
    head: {
      title: 'Claude Board',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'color-scheme', content: 'dark light' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      // Applies the saved theme and text size before first paint, to avoid a flash.
      script: [
        {
          innerHTML:
            "try{var d=document.documentElement.dataset,t=localStorage.getItem('board-theme'),s=localStorage.getItem('board-text-size');if(t==='light'||t==='dark')d.theme=t;if(s==='small'||s==='large')d.textSize=s}catch(e){}",
          tagPosition: 'head',
        },
      ],
    },
  },
  nitro: {
    experimental: {
      websocket: false,
    },
  },
})

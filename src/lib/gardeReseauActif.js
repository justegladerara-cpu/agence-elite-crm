// Importé en premier par main.jsx : en mode démo ou en aperçu, le garde-fou réseau est posé avant tout le reste.
import { installerGardeReseau } from './gardeReseau'

const CRM_BRANCHE = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
if (!CRM_BRANCHE || import.meta.env.VITE_PREVISUALISATION === '1') installerGardeReseau()

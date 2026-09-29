// Contexte découpé (étape 3) : le noyau (réglages, services) séparé des données métier.
// useNoyau : settings, api, toast, openAction, saisirArgent, live — ce dont tout module a besoin.
// useDonnees : prospects, actions, documents et data (calculs du Commercial).
// useApp reste la fusion des deux, le temps de migrer les pages une à une.
import { createContext, useContext } from 'react'

export const NoyauCtx = createContext(null)
export const DonneesCtx = createContext(null)
export const useNoyau = () => useContext(NoyauCtx)
export const useDonnees = () => useContext(DonneesCtx)
export const useApp = () => ({ ...useContext(DonneesCtx), ...useContext(NoyauCtx) })

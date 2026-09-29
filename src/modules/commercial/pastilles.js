// Commercial › pastilles du menu : relances à faire et clients à surveiller
export const pastillesCommercial = ({ data }) => ({
  journee: [data.aRelancer.length, 'hot', 'relances à faire'],
  clients: [data.clientsAlertes.length, '', 'clients à surveiller'],
})

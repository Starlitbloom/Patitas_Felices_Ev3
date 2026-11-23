/* MOLÉCULA — Aviso de microservicios que no respondieron.
   report-service informa en "serviciosNoDisponibles" qué servicio
   estaba apagado: esos datos se muestran como "—" y aquí se explica por qué. */

export interface AvisoServiciosProps {
  servicios: string[]
}

export function AvisoServicios({ servicios }: AvisoServiciosProps) {
  if (servicios.length === 0) return null
  return (
    <div className="admin-aviso admin-aviso--error" role="status">
      <span>
        Algunos datos no están disponibles porque no respondió: <strong>{servicios.join(', ')}</strong>. Se muestran como
        “—”.
      </span>
    </div>
  )
}

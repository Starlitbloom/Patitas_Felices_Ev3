/* Punto de entrada: carga estilos, prepara los datos y monta la app. */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// 1) Bootstrap primero, 2) estilos de la EP1 encima, 3) ajustes para React
import 'bootstrap/dist/css/bootstrap.min.css'
import './styles/styles.css'
import './styles/estilo-index.css'
import './styles/estilo-usuarios.css'
import './styles/estilo-admin.css'
import './styles/estilo-equipo.css'
import './styles/estilo-mascotas.css'
import './styles/estilo-detalle-mascota.css'
import './styles/estilo-clinico.css'
import './styles/ajustes-react.css'

import App from './App'
import { asegurarDatosInicialesMascotas } from './services/mascotasService'

// EP3: los usuarios y las cuentas fijas ya no se cargan aquí: viven en auth-service (MySQL)
asegurarDatosInicialesMascotas() // carga mascotas, historiales y vacunas de ejemplo

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
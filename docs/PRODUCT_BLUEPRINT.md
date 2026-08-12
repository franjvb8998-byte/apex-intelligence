# APEX Intelligence — Product Blueprint

**Documento oficial de producto**  
**Estado:** Fundacional  
**Audiencia:** Producto, Ingeniería, Diseño, Datos, Negocio  
**Idioma de producto:** Español  

---

## 1. Visión

Convertir la toma de decisiones en apuestas deportivas en un proceso medible, disciplinado y basado en evidencia.

APEX Intelligence aspira a ser la capa de inteligencia que transforma el historial, el contexto del partido y las señales del modelo en claridad accionable: qué apostar, cuándo no apostar y cómo mejorar con el tiempo.

La visión no es “ganar siempre”. Es **decidir mejor de forma consistente**.

---

## 2. Misión

Ayudar a apostadores analíticos a:

1. Entender su rendimiento real (no su percepción).
2. Evaluar partidos con señales claras y trazables.
3. Registrar predicciones y resultados de forma estructurada.
4. Aprender de sus propios patrones para reducir decisiones impulsivas.

Hacemos esto mediante una plataforma que combina **historial del usuario**, **datos deportivos** y un **motor de predicción** con niveles de confianza explícitos.

---

## 3. Filosofía

APEX se construye sobre estas creencias:

- **La disciplina supera a la intuición.** El producto premia el proceso, no el resultado aislado.
- **La transparencia genera confianza.** Toda predicción debe poder explicarse en términos comprensibles (señales, confianza, incertidumbre).
- **Menos ruido, más señal.** Preferimos una recomendación clara con contexto a un dashboard saturado de métricas.
- **El usuario es responsable.** APEX informa y estructura; no garantiza resultados ni sustituye el criterio del usuario.
- **El producto debe ser honesto sobre lo que no sabe.** Cuando la confianza es baja, el sistema debe decirlo.

---

## 4. Principios del producto

| Principio | Implicación práctica |
| --- | --- |
| Claridad primero | Cada pantalla tiene un trabajo principal. Si compite con otro mensaje, sobra. |
| Evidencia visible | No mostrar “picks” sin confianza, contexto o historial asociado. |
| Feedback de ciclo completo | Predicción → resultado → aprendizaje. El valor está en el ciclo, no en el tip aislado. |
| Progresión, no complejidad | Empezar simple (login, dashboard, predicciones básicas) y añadir profundidad por capas. |
| Confianza calibrada | Una predicción con baja confianza es más valiosa que una falsa certeza. |
| Privacidad por defecto | El historial y las predicciones del usuario son datos sensibles; se tratan como tales. |
| Extensibilidad deliberada | Nuevas ligas, modelos o módulos entran solo si refuerzan la misión. |

---

## 5. Perfil del usuario

### Usuario primario: el apostador analítico

Persona que ya apuesta (o está empezando de forma seria) y quiere dejar de decidir “a ojo”.

**Características típicas**

- Consume resultados, cuotas y estadísticas, pero no tiene un sistema propio.
- Siente que “a veces le va bien”, pero no puede demostrar si es skill o varianza.
- Valora herramientas claras más que tipsters opacos.
- Quiere un registro de sus decisiones y un panel de rendimiento.

**Motivaciones**

- Mejorar el edge a medio plazo.
- Reducir errores emocionales (chase, overbetting, sesgo de confirmación).
- Tener un lugar único para ver partidos, predicciones y su propio historial.

**Frustraciones actuales**

- Tips sin explicación.
- Hojas de cálculo frágiles o abandonadas.
- Demasiadas fuentes sin síntesis.
- Imposibilidad de medir si realmente mejora.

### Usuario secundario (futuro)

- Analistas / tipsters que quieren empaquetar su proceso.
- Operadores internos (admin de datos, curación de ligas/partidos).

### No es el usuario objetivo (por ahora)

- Apostadores recreativos que solo buscan “el tip del día”.
- Usuarios que esperan señales automáticas sin responsabilidad personal.
- Casinos / productos de azar no deportivo.

---

## 6. Propuesta de valor

**Para el apostador analítico que quiere decidir con datos,**  
APEX Intelligence es la plataforma que **analiza tu historial, contextualiza partidos y entrega predicciones con confianza explícita**,  
**a diferencia de tipsters y apps de tips**,  
porque **mide tu rendimiento real y te ayuda a construir un proceso repetible**, no solo a seguir recomendaciones.

### Promesa de producto (mensaje actual)

> Analiza tu historial, mide tu rendimiento y toma decisiones basadas en datos.

### Promesa ampliada (producto completo)

> Convierte cada partido en una decisión informada: predicción del modelo, tu predicción, resultado y aprendizaje.

---

## 7. Diferenciadores

1. **Ciclo cerrado de decisión**  
   Predicción del sistema + predicción del usuario + resultado + métricas. No es un feed de tips.

2. **Confianza explícita**  
   El motor no solo dice “local/empate/visitante”; comunica qué tan seguro está y cuándo abstenerse.

3. **Historial como activo**  
   El rendimiento del usuario es un producto en sí mismo, no un afterthought.

4. **Arquitectura lista para inteligencia**  
   Datos estructurados (ligas, equipos, partidos, predicciones) diseñados para alimentar el motor, no solo la UI.

5. **Honestidad de producto**  
   Priorizamos calibración y trazabilidad frente a marketing de “certezas”.

6. **Experiencia enfocada**  
   Una composición clara por pantalla; menos ruido visual y más jerarquía de decisión.

---

## 8. Arquitectura funcional

APEX se organiza en capas. Cada capa tiene un rol claro; las dependencias fluyen hacia abajo.

```text
┌─────────────────────────────────────────────┐
│  Experiencia (Web App)                      │
│  Auth · Dashboard · Predicciones · Perfil   │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│  Dominio de producto                        │
│  Usuarios · Ligas · Partidos · Predicciones │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│  Motor de inteligencia                      │
│  Features · Modelo · Confianza · Evaluación │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│  Datos y plataforma                         │
│  Supabase (Auth, DB) · Jobs · Integraciones │
└─────────────────────────────────────────────┘
```

### Flujos principales

| Flujo | Descripción |
| --- | --- |
| Identidad | Registro / login / sesión → acceso al área autenticada |
| Catálogo deportivo | Ligas → equipos → partidos programados o finalizados |
| Inteligencia | Partido → features → predicción del modelo → confianza |
| Decisión del usuario | Usuario registra su predicción (y opcionalmente stake/notas) |
| Cierre de ciclo | Resultado del partido → evaluación de predicciones → métricas |
| Aprendizaje | Dashboard de rendimiento y patrones del usuario |

---

## 9. Módulos principales

### 9.1 Autenticación y perfil

- Registro, inicio de sesión y gestión de sesión.
- Perfil de usuario (`profiles`) vinculado a la identidad.
- Base para personalización y ownership de predicciones.

### 9.2 Catálogo deportivo

- **Ligas:** competiciones activas y metadatos (país, deporte, temporada).
- **Equipos:** entidades por liga.
- **Partidos:** enfrentamientos con estado (`scheduled`, `live`, `finished`, etc.), marcador y horario.

### 9.3 Motor de predicciones (sistema)

- Genera predicciones por partido (`predictions`).
- Incluye outcome predicho, probabilidades y confianza.
- Versionado de modelo para trazabilidad.

### 9.4 Predicciones del usuario

- El usuario registra su lectura del partido (`user_predictions`).
- Puede asociarse a una predicción del sistema o ser independiente.
- Unicidad por usuario/partido para mantener historial limpio.

### 9.5 Dashboard de rendimiento

- Vista autenticada del estado del usuario.
- Resumen de actividad, aciertos, confianza media y evolución.
- Punto de entrada diario al producto.

### 9.6 Capa de aprendizaje (evolución)

- Insights sobre sesgos (p. ej. overbetting en empates, peor rendimiento en cierta liga).
- Comparación usuario vs modelo.
- Recomendaciones de proceso (no solo de pick).

---

## 10. Innovation Backlog

Ideas priorizables que **no** definen el MVP, pero orientan la ventaja competitiva futura.

| Idea | Valor | Complejidad | Notas |
| --- | --- | --- | --- |
| Explicabilidad de predicciones (“por qué”) | Alto | Media | Aumenta confianza del usuario |
| Alertas de valor (cuota vs probabilidad modelo) | Alto | Alta | Requiere fuentes de cuotas |
| Calibración personalizada del modelo al usuario | Alto | Alta | Riesgo de overfitting |
| Modo “no apostar” como feature de primera clase | Alto | Baja | Alineado a la filosofía |
| Bankroll tracker y sizing sugerido | Medio | Media | Sensible regulatoriamente |
| Comparativa comunitaria anónima | Medio | Alta | Requiere volumen y privacidad |
| Ingesta automática de resultados | Alto | Media | Crítico para cerrar el ciclo sin fricción |
| Multi-deporte más allá de fútbol | Medio | Alta | Solo tras profundidad en un deporte |
| API pública / embeds para tipsters | Bajo–Medio | Alta | Monetización futura |
| Simulador de estrategias sobre historial | Alto | Alta | Diferenciador fuerte de aprendizaje |

**Regla de backlog:** ninguna idea entra a roadmap activo sin (a) hipótesis de valor, (b) métrica de éxito y (c) criterio de salida.

---

## 11. Roadmap por fases

### Fase 0 — Fundación (actual / inmediata)

**Objetivo:** plataforma usable y datos listos.

- Autenticación real (Supabase).
- Esquema de datos fundacional.
- Documentación de producto y arquitectura.
- Shell de dashboard autenticado.

**Criterio de salida:** un usuario puede registrarse, iniciar sesión y acceder a un área privada estable.

### Fase 1 — MVP de decisión

**Objetivo:** el usuario completa el primer ciclo de valor.

- Catálogo básico de ligas, equipos y partidos.
- Visualización de partidos próximos.
- Predicciones del sistema (versión inicial, aunque sea simple).
- Registro de predicciones del usuario.
- Dashboard con métricas mínimas (nº predicciones, aciertos cuando haya resultados).

**Criterio de salida:** un usuario puede ver un partido, ver/registrar una predicción y consultar su historial básico.

### Fase 2 — Capa de inteligencia

**Objetivo:** el modelo aporta ventaja percibida y medible.

- Pipeline de features.
- Confianza calibrada y presentación honesta de incertidumbre.
- Evaluación offline del modelo (accuracy, log-loss, calibración).
- Cierre automático de resultados.

**Criterio de salida:** las predicciones del sistema se generan de forma repetible y se evalúan con métricas internas.

### Fase 3 — Rendimiento y hábito

**Objetivo:** APEX se vuelve el sistema diario del usuario.

- Insights de rendimiento y sesgos.
- Comparativa usuario vs modelo.
- Notificaciones / recordatorios de partidos relevantes.
- Mejoras de UX en el flujo de decisión.

**Criterio de salida:** retención y uso recurrente impulsados por el dashboard de aprendizaje.

### Fase 4 — Escala y expansión

**Objetivo:** crecer en cobertura y canales sin romper el núcleo.

- Más ligas / competiciones con calidad de datos.
- Integraciones de cuotas (si hay caso de valor claro).
- Posible API / partnership.
- Endurecimiento de plataforma (rate limits, observabilidad, costos).

**Criterio de salida:** el producto escala usuarios y datos manteniendo claridad y calibración.

---

## 12. Riesgos del proyecto

| Riesgo | Impacto | Probabilidad | Mitigación |
| --- | --- | --- | --- |
| Expectativa de “tips garantizados” | Alto | Alta | Messaging honesto; confianza baja visible; educación en producto |
| Modelo poco calibrado o sobreprometido | Alto | Media | Métricas de evaluación; no lanzar picks sin umbral de calidad |
| Datos deportivos incompletos o tardíos | Alto | Media | Empezar con pocas ligas; jobs de ingesta; estados de partido explícitos |
| Baja retención tras el primer uso | Alto | Media | Ciclo completo en MVP; valor en historial personal desde el día 1 |
| Complejidad prematura (demasiadas métricas) | Medio | Alta | Principio “claridad primero”; cortar features no esenciales |
| Cumplimiento / percepción de juego responsable | Alto | Media | Copy responsable; sin promesas de ganancia; tools de autolimitación a futuro |
| Dependencia de un solo deporte o liga | Medio | Media | Profundidad antes que amplitud; diseño de esquema multi-liga |
| Deuda técnica en auth/sesión/proxy | Medio | Media | Mantener rutas públicas no bloqueadas; pruebas de login/dashboard |
| Falta de ownership de datos de cuotas | Medio | Alta | No bloquear MVP por cuotas; tratarlas como fase posterior |
| Equipo construye features sin norte de producto | Medio | Media | Este blueprint como fuente de verdad; decisiones registradas en `DECISIONS.md` |

---

## 13. Métricas de éxito

### Norte (producto)

- **Decisiones informadas completadas:** predicciones de usuario registradas sobre partidos con predicción del sistema disponible.

### Activación

- % de registros que llegan a dashboard.
- Tiempo hasta la primera predicción de usuario.
- % de usuarios que ven al menos un partido con predicción del sistema en la primera sesión.

### Engagement

- Predicciones de usuario / usuario activo semanal.
- Sesiones semanales por usuario activo.
- % de usuarios que vuelven en 7 días (D7) y 30 días (D30).

### Calidad del motor

- Accuracy / log-loss del modelo por liga y por versión.
- Calibración de confianza (¿el 70% de confianza acierta ~70%?).
- Tasa de “abstención” cuando la confianza está bajo umbral (si se implementa).

### Valor percibido

- % de usuarios que consultan historial de rendimiento semanalmente.
- Comparativa usuario vs modelo (delta de aciertos) como señal de aprendizaje, no como ranking social prematuro.

### Salud del negocio (cuando aplique)

- Retención de cohortes.
- Costo de infraestructura por usuario activo.
- Conversión a plan de pago (si se introduce monetización).

### Anti-métricas (no optimizar)

- Volumen de tips publicados sin calidad.
- Clicks en predicciones de baja confianza sin contexto.
- Promesas de ROI en comunicación.

---

## 14. Glosario

| Término | Definición |
| --- | --- |
| **APEX Intelligence** | Producto: plataforma de inteligencia para decisiones en apuestas deportivas. |
| **Perfil (`profiles`)** | Datos de producto del usuario vinculados a su identidad de autenticación. |
| **Liga** | Competición deportiva que agrupa equipos y partidos. |
| **Equipo** | Participante de una liga. |
| **Partido (`match`)** | Enfrentamiento entre dos equipos en una liga, con horario y estado. |
| **Predicción del sistema** | Outcome y/o probabilidades generadas por el motor de inteligencia para un partido. |
| **Predicción del usuario** | Lectura registrada por el usuario sobre un partido. |
| **Outcome** | Resultado categórico predicho o real: local (`home`), empate (`draw`), visitante (`away`). |
| **Confianza** | Grado de certeza del modelo sobre su predicción, expresado de forma explícita al usuario. |
| **Calibración** | Alineación entre la confianza declarada y la frecuencia real de aciertos. |
| **Ciclo de decisión** | Flujo completo: contexto → predicción → registro → resultado → aprendizaje. |
| **Edge** | Ventaja informativa o de proceso del usuario frente al azar o al mercado. |
| **MVP** | Versión mínima que permite completar el primer ciclo de valor de punta a punta. |
| **Motor de inteligencia** | Conjunto de procesos que transforman datos de partido en predicciones evaluables. |
| **Dashboard** | Vista principal autenticada para rendimiento, actividad y acceso a decisiones. |
| **Innovation Backlog** | Lista de apuestas de producto futuras, no comprometidas al roadmap activo. |
| **RLS** | Row Level Security: reglas de acceso a datos a nivel de fila en la base de datos. |

---

## Uso de este documento

Este blueprint es la **guía oficial de producto** de APEX Intelligence.

- Producto lo usa para priorizar y decir “no”.
- Ingeniería lo usa para alinear módulos y dependencias.
- Diseño lo usa para mantener claridad y jerarquía.
- Datos/AI lo usa para definir qué significa una predicción de calidad.
- Negocio lo usa para alinear narrativa y métricas.

Cuando una decisión de producto cambie el rumbo, actualizar este documento y registrar el cambio en `docs/DECISIONS.md`.

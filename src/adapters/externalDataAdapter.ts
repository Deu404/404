/**
 * Boundary for a future provider adapter.
 *
 * The provider payload remains unknown until the analysis team supplies a
 * schema. Add field mapping and validation in a concrete adapter then, rather
 * than assuming external field names in the domain layer.
 */
export type ExternalDataMappingContext = Readonly<Record<string, unknown>>

export type ExternalDataAdapter<DomainValue, MappingContext = ExternalDataMappingContext> = (
  input: unknown,
  context?: MappingContext,
) => DomainValue | null | undefined

/**
 * Applies a future adapter without allowing an invalid provider payload to
 * interrupt a synchronous data read.
 * TODO: Connect concrete JSON field mapping after the external schema exists.
 */
export function adaptExternalData<DomainValue, MappingContext = ExternalDataMappingContext>(
  input: unknown,
  adapter: ExternalDataAdapter<DomainValue, MappingContext>,
  fallback: DomainValue,
  context?: MappingContext,
): DomainValue {
  try {
    return adapter(input, context) ?? fallback
  } catch {
    return fallback
  }
}

/**
 * Applies an adapter to a provider collection without treating malformed
 * records as valid domain values. Empty collections remain empty so that a
 * provider can explicitly report that it has no records.
 */
export function adaptExternalCollection<DomainValue, MappingContext = ExternalDataMappingContext>(
  input: unknown,
  adapter: ExternalDataAdapter<DomainValue, MappingContext>,
  fallback: DomainValue[] = [],
  context?: MappingContext,
): DomainValue[] {
  if (!Array.isArray(input)) return fallback
  if (input.length === 0) return []

  return input.flatMap((value) => {
    const adapted = adaptExternalData(value, adapter, undefined, context)
    return adapted === undefined ? [] : [adapted]
  })
}

export const adaptExternalDataList = adaptExternalCollection

# Preserve composite identity

When the fallback is selected, equal key-value groups created by one module instance return the same object.
Keep one package instance wherever that identity must be shared.

Separate fallback copies do not share interning registries or cross-realm identity.
The fallback also cannot reproduce the proposal's rejection from weak collections, and it searches live composites linearly.
A native `Composite` can therefore have different identity, weak-collection, and performance behavior from the fallback.

# Intellij / PhpStorm PHP Plugin's CostAdaptiveCache - Deep Dive

*Created: 2026-03-01*

## What It Is

`CostAdaptiveCache` is a sophisticated caching mechanism used extensively in JetBrains' PHP plugin. It's a **cost-aware, adaptive cache** that automatically evicts entries based on computation cost and memory pressure.

**Location in PHP Plugin:** `com.jetbrains.php.caches.CostAdaptiveCache` (Kotlin)

## The Problem It Solves

In an IDE, many operations are expensive (require index lookups, PSI traversal, etc.) and are called frequently. A simple cache isn't enough because:

1. **Memory is limited** - Can't cache everything forever
2. **Computation costs vary** - Some lookups take 1ms, others 100ms
3. **Memory pressure happens** - IDE runs low on memory during heavy use
4. **Cache invalidation is tricky** - When to invalidate?

`CostAdaptiveCache` solves all of these by:
- Tracking how long each computation took
- Preferring to evict cheap-to-compute items when full
- Responding to low-memory events
- Using soft references for optional retention

---

## How It Works

### Core Concept: Cost-Based Eviction

When you compute a value, the cache measures how long it took:

```kotlin
// From CostAdaptiveCache.kt (decompiled)
public fun getOrCompute(key: String, generator: (String) -> Any): Any {
    // 1. Try to get from cache (read lock)
    val cached = map.get(key)
    if (cached != null) return cached

    // 2. Measure computation time
    val startTime = System.nanoTime()
    val value = generator.invoke(key)
    val duration = System.nanoTime() - startTime

    // 3. Store with cost = log2(duration)
    //    - 1ms = cost ~20
    //    - 100ms = cost ~27
    val cost = log2(duration)
    update(key, value, cost)

    return value
}
```

### Cost Calculation: log2(duration)

The cost is calculated as `log2(nanoseconds)`:
- 1 microsecond = 10^3 ns → cost = ~10
- 1 millisecond = 10^6 ns → cost = ~20
- 100 milliseconds = 10^8 ns → cost = ~27

This logarithmic scale means:
- Very fast operations (cheap) have low cost
- Slow operations (expensive) have high cost
- The difference between 1ms and 100ms is only ~7 cost units

### Eviction Strategy: Keep Expensive Items

When the cache is full and needs to make room:

```kotlin
private fun selectRemovalCandidate(cost: Byte): ByteArray? {
    if (map.size() < maxCapacity) return null

    // Randomly evict from items with cost <= current cost
    // With 0.5% chance, evict from any item (exploration)
    val threshold = if (Random.nextInt(200) == 0) 64 else cost
    return map.randomKeyBelowCost(threshold)
}
```

**Key insight:** When adding a new item with cost X, we try to evict an item with cost ≤ X. This means:
- Expensive items (high cost) are rarely evicted
- Cheap items (low cost) are evicted first
- The cache naturally optimizes for minimizing recomputation time

### Soft References (Optional)

```kotlin
// Constructor with softReferences flag
public constructor(maxCapacity: Int, softReferences: Boolean)

private fun createMap(): CostSamplingMap<ByteArray, Any> {
    return if (softReferences) {
        SoftValuesMap(CostEncodingMap())  // Values can be GC'd under memory pressure
    } else {
        CostEncodingMap()  // Strong references
    }
}
```

When `softReferences = true`:
- Values are wrapped in `SoftReference`
- GC can collect them under memory pressure
- Cache automatically handles null values from GC'd references

---

## How PHP Plugin Uses It

### PhpCaches - Central Cache Manager

```java
// From PhpCaches.java (decompiled)
@Service({Level.PROJECT})
public final class PhpCaches implements Disposable {

    // Cache size scales with available heap memory
    private static final int BASE_SIZE = Math.toIntExact(
        ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getMax() >> 21
    );

    // Various caches with different purposes and sizes
    public volatile CostAdaptiveCache<PhpType> TYPE_COMPLETION_CACHE =
        new CostAdaptiveCache<>(32 * BASE_SIZE);

    public volatile CostAdaptiveCache<Collection<PhpClass>> classCache =
        new CostAdaptiveCache<>(16 * BASE_SIZE, true);  // soft references

    public volatile CostAdaptiveCache<Collection<PhpClass>> subclassCache =
        new CostAdaptiveCache<>(4 * BASE_SIZE, true);

    public volatile CostAdaptiveCache<Collection<Function>> functionsCache =
        new CostAdaptiveCache<>(8 * BASE_SIZE, true);

    // ... more caches

    public void clearCaches(boolean onLowMem) {
        TYPE_COMPLETION_CACHE.clear(onLowMem);
        classCache.clear(onLowMem);
        // ... clear all caches

        // For non-adaptive caches, recreate the map
        if (!TYPE_CACHE.isEmpty()) {
            Map<PsiElement, PhpType> previousMap = TYPE_CACHE;
            TYPE_CACHE = CollectionFactory.createConcurrentWeakMap();
            previousMap.clear();
        }
    }
}
```

### Usage Pattern in PhpIndexImpl

```java
// From PhpIndexImpl.java (decompiled)
private Collection<PhpClass> getByFqnCacheAware(String fqn, StubIndexKey<String, PhpClass> key) {
    // Get the appropriate cache based on index type
    CostAdaptiveCache<Collection<PhpClass>> cache = getCache(key);

    // Try cache first, compute if missing
    Collection<PhpClass> result = (Collection<PhpClass>) cache.getOrCompute(
        fqn,
        k -> {
            // Expensive index lookup
            return StubIndex.getInstance().get(key, k, scope);
        }
    );

    return result;
}
```

### Cache Invalidation on PSI Changes

```java
public PhpCaches(Project project) {
    // Clear caches on low memory
    this.myLowMemoryWatcher = LowMemoryWatcher.register(() -> this.clearCaches(true));

    // Clear caches on PSI modifications
    Listener modificationHandler = () -> this.clearCaches(false);
    MessageBusConnection connection = project.getMessageBus().connect();
    connection.subscribe(PsiModificationTracker.TOPIC, modificationHandler);
}
```

---

## Cache Size Scaling

The PHP plugin scales cache sizes based on available heap:

```java
// BASE_SIZE = maxHeap / 2MB
// On a 2GB heap: BASE_SIZE ≈ 1024
// On a 8GB heap: BASE_SIZE ≈ 4096

// Cache multipliers:
TYPE_COMPLETION_CACHE = 32 * BASE_SIZE     // ~32K-128K entries
classCache = 16 * BASE_SIZE                 // ~16K-64K entries
subclassCache = 4 * BASE_SIZE               // ~4K-16K entries
functionsCache = 8 * BASE_SIZE              // ~8K-32K entries
```

---

## Key Takeaways for Symfony Plugin

### 1. Use Cost-Adaptive Caching for Expensive Operations

```java
// Good candidate: Service lookup by class name
CostAdaptiveCache<Collection<String>> serviceByClassCache =
    new CostAdaptiveCache<>(4 * BASE_SIZE, true);

public Collection<String> getServicesByClassName(String className) {
    return serviceByClassCache.getOrCompute(className, k -> {
        // Expensive: iterate all services, check class names
        return findServicesByClass(k);
    });
}
```

### 2. Combine with PSI Modification Tracking

```java
public class SymfonyCaches implements Disposable {
    private final CostAdaptiveCache<Collection<PhpClass>> namespaceClassCache;

    public SymfonyCaches(Project project) {
        this.namespaceClassCache = new CostAdaptiveCache<>(8 * getBaseSize(), true);

        // Clear on PSI changes
        project.getMessageBus().connect().subscribe(
            PsiModificationTracker.TOPIC,
            () -> namespaceClassCache.clear(false)
        );

        // Clear on low memory
        LowMemoryWatcher.register(() -> namespaceClassCache.clear(true));
    }
}
```

### 3. Use for Namespace-to-Classes Mapping

```java
// Cache namespace -> classes in that namespace
public Collection<PhpClass> getClassesInNamespace(String namespace) {
    return namespaceClassCache.getOrCompute(namespace, ns -> {
        // Expensive: PhpIndex lookup + filtering
        return PhpIndexUtil.getPhpClassInsideNamespace(project, ns);
    });
}
```

---

## Implementation Notes

### Thread Safety

```kotlin
// Uses ReentrantReadWriteLock for thread-safe access
private val lock: ReentrantReadWriteLock

public fun getOrCompute(key: String, generator: (String) -> Any): Any {
    lock.readLock().lock()
    try {
        val cached = map.get(encodeKey(key))
        if (cached != null) return cached
    } finally {
        lock.readLock().unlock()
    }

    // Upgrade to write lock for computation
    lock.writeLock().lock()
    try {
        // Double-check after acquiring write lock
        val cached = map.get(encodeKey(key))
        if (cached != null) return cached

        val value = generator.invoke(key)
        update(key, value, cost)
        return value
    } finally {
        lock.writeLock().unlock()
    }
}
```

### Key Encoding

Keys are encoded with their cost byte for efficient storage:

```kotlin
// KeyEncoder encodes: [cost_byte][key_bytes]
fun encode(key: String, cost: Byte): ByteArray
```

This allows the map to:
1. Store cost with the key
2. Sample costs for eviction decisions
3. Keep encoded map values compact

---

## When NOT to Use

`CostAdaptiveCache` is overkill for:
- Simple, fast lookups (just use `ConcurrentHashMap`)
- Small, bounded caches (use `Map` with size limit)
- Static data that never changes

Best used for:
- Expensive index operations
- PSI traversal results
- Type inference results
- Cross-file resolution

---

## Summary Table

| Feature | Description |
|---------|-------------|
| **Cost Tracking** | Measures computation time, stores as log2(nanos) |
| **Adaptive Eviction** | Evicts cheap items first, keeps expensive ones |
| **Soft References** | Optional; allows GC under memory pressure |
| **Thread Safe** | ReentrantReadWriteLock for concurrent access |
| **Memory Scaling** | Cache size scales with heap size |
| **Invalidation** | Manual clear on PSI changes or low memory |

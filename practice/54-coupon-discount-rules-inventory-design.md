---
schema_version: 1
question_id: 54
question: "优惠券/满减活动规则和库存怎么设计？"
date: 2026-07-05
sources:
  - tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md
  - chayanyuese/2026-05-26-chayanyuese-java-round2-scenario-35k.md
  - java/baidu-java-backend-round1-shezhao.md
score: "4/10"
round: R0
next_review: 2026-07-06
session_id: unknown
status: completed
---
## 第54题 · 系统设计 · 优惠券/满减活动规则和库存怎么设计？

**题目**：优惠券/满减活动规则和库存怎么设计？

### 用户回答

> 1 规则引擎 EL 表达式？2 库存扣减 可以通过lua脚本来保证；3 先看哪个为先把，先叠加再爱再看？

### 评分：4/10

| 维度 | 得分 | 说明 |
|------|------|------|
| 规则引擎 | 1/10 | 只提了EL表达式，没展开规则引擎的设计思路 |
| 库存扣减 | 2/10 | 方向对（Lua保证原子性），但没展开具体实现和边界 |
| 叠加/互斥规则 | 0.5/10 | 没说清楚，逻辑模糊 |
| 整体架构 | 0.5/10 | 缺整体设计思路，只有零散关键词 |

### 扣分点

1. 规则引擎只说了EL表达式，没有对比策略模式/Drools等方案（-0.5）
2. Lua扣减只说了"可以"，没说具体实现和DB同步方案（-0.5）
3. 叠加互斥规则完全没讲清，"先叠加再看"逻辑不清（-0.5）

### 追问+纠正记录

1. **预扣是什么？** → Redis Lua脚本先扣Redis库存（毫秒级原子操作），DB通过MQ异步最终落库。预扣≠最终扣减，中间用MQ做异步同步。
2. **库存分片是什么？** → 把一个大库存拆成多个小库存（如1000拆成10个100），扣减时随机选一个分片。好处是把热点key竞争分散，QPS大幅提升。和数据库分库分表是同一个思路。

### 最终结论

优惠券系统核心是**规则引擎 + 库存防超卖 + 叠加互斥**：

① **规则引擎**：用策略模式，每种券类型一个Strategy实现，通过配置管理规则。比EL表达式更灵活可控。

② **库存防超卖**：Redis Lua脚本保证原子性，DB用MQ做最终一致。Lua预扣成功后发MQ，消费端落库，失败可重试。

③ **叠加互斥**：互斥组内只能选一张，叠加组内按优先级依次计算。优先级：单品券→全场券→运费券。

④ **高并发**：Redis预扣+令牌限流+库存分片，把热点从DB移到Redis，再用限流保护下游。

### 这次讨论的收获

- 预扣机制：Redis预扣 + MQ异步 + DB最终一致，兼顾性能和数据安全
- 库存分片：分散热点key竞争，和数据库分片是同一思路
- 规则引擎：策略模式比EL表达式更适合生产，可维护性更好

---

## 一、优惠券系统整体架构

```
用户领取 → 选券 → 规则计算 → 库存扣减 → 订单生成 → 核销

核心模块：
① 优惠券模板管理（创建规则）
② 优惠券实例管理（用户持有的券）
③ 规则引擎（计算优惠金额）
④ 库存管理（防超卖）
⑤ 互斥/叠加规则（多券组合）
```

## 二、优惠券类型和规则设计

| 类型 | 规则示例 | 计算逻辑 |
|------|----------|----------|
| 满减券 | 满100减20 | orderAmount >= 100 → 减20 |
| 折扣券 | 8折券，最高减50 | orderAmount × 0.2，上限50 |
| 直减券 | 无门槛减10 | 直接减10 |
| 免单券 | 免单上限30 | min(orderAmount, 30) |
| 运费券 | 免运费 | 运费=0 |

**规则引擎方案对比：**

| 方案 | 优点 | 缺点 |
|------|------|------|
| 硬编码 if/else | 简单直接 | 新增规则要改代码 |
| EL表达式 | 灵活、可配置 | 性能一般、调试难 |
| Drools 规则引擎 | 功能强大、可热更 | 学习成本高 |
| 策略模式+配置 | 推荐！兼顾灵活和可维护 | 需要前期设计 |

## 三、策略模式实现（生产推荐）

```java
// 1. 定义优惠策略接口
public interface DiscountStrategy {
    BigDecimal calculate(Order order, Coupon coupon);
    boolean supports(CouponType type);
}

// 2. 实现各类型
@Component
public class FullReductionStrategy implements DiscountStrategy {
    @Override
    public BigDecimal calculate(Order order, Coupon coupon) {
        if (order.getAmount().compareTo(coupon.getThreshold()) >= 0) {
            return coupon.getDiscountAmount();
        }
        return BigDecimal.ZERO;
    }
    @Override
    public boolean supports(CouponType type) {
        return type == CouponType.FULL_REDUCTION;
    }
}

@Component
public class DiscountRateStrategy implements DiscountStrategy {
    @Override
    public BigDecimal calculate(Order order, Coupon coupon) {
        BigDecimal discount = order.getAmount()
            .multiply(BigDecimal.ONE.subtract(coupon.getRate()));
        return discount.min(coupon.getMaxDiscount());
    }
    @Override
    public boolean supports(CouponType type) {
        return type == CouponType.DISCOUNT_RATE;
    }
}

// 3. 规则引擎：根据券类型自动选择策略
@Service
public class CouponRuleEngine {
    private final Map<CouponType, DiscountStrategy> strategyMap;

    @Autowired
    public CouponRuleEngine(List<DiscountStrategy> strategies) {
        this.strategyMap = strategies.stream()
            .collect(Collectors.toMap(
                DiscountStrategy::supports,
                Function.identity()
            ));
    }

    public BigDecimal calculate(Order order, Coupon coupon) {
        DiscountStrategy strategy = strategyMap.get(coupon.getType());
        if (strategy == null) {
            throw new UnsupportedCouponTypeException(coupon.getType());
        }
        return strategy.calculate(order, coupon);
    }
}
```

## 四、叠加规则和互斥规则

**互斥类型：**
- 互斥组：同一互斥组内的券只能选一张（如满减券和折扣券互斥）
- 叠加组：同一叠加组内的券可以叠加使用（如运费券+满减券）
- 单品/全场：单品券先算 → 再用全场券

**计算顺序：**
```
1. 先算单品优惠（单品折扣、单品满减）
2. 再算全场优惠（全场满减、全场折扣）
3. 最后算运费优惠
```

**互斥判断逻辑：**

```java
public List<Coupon> selectBestCoupons(Long userId, Order order) {
    List<Coupon> available = getUserAvailableCoupons(userId, order);

    // 按互斥组分组
    Map<String, List<Coupon>> mutualGroups = available.stream()
        .collect(Collectors.groupingBy(Coupon::getMutualGroup));

    // 每个互斥组内选最优的一张
    List<Coupon> selected = new ArrayList<>();
    for (List<Coupon> group : mutualGroups.values()) {
        Coupon best = group.stream()
            .max(Comparator.comparing(c -> calculateDiscount(order, c)))
            .orElse(null);
        if (best != null) {
            selected.add(best);
        }
    }

    // 按优先级排序（单品券先算）
    selected.sort(Comparator.comparingInt(Coupon::getPriority));
    return selected;
}
```

## 五、库存扣减防超卖

**方案对比：**

| 方案 | 实现 | 优点 | 缺点 |
|------|------|------|------|
| Redis Lua | Lua脚本原子操作 | 高性能、简单 | 数据在Redis，需要同步DB |
| 数据库乐观锁 | UPDATE count=count-1 WHERE count>0 | 强一致 | 并发高时冲突多 |
| 数据库悲观锁 | SELECT ... FOR UPDATE | 强一致 | 性能差、死锁风险 |
| Redis + DB双写 | Redis预扣 + DB异步落库 | 兼顾性能和一致性 | 架构复杂 |

**Redis Lua预扣实现：**

```lua
-- KEYS[1] = 库存key
-- ARGV[1] = 扣减数量
local stock = tonumber(redis.call('GET', KEYS[1]) or 0)
local quantity = tonumber(ARGV[1])

if stock >= quantity then
    redis.call('DECRBY', KEYS[1], quantity)
    return 1  -- 扣减成功
else
    return 0  -- 库存不足
end
```

**DB同步方案（最终一致）：**
```
① Redis Lua预扣成功 → 发MQ消息
② 消费者收到消息 → DB扣库存 + 记录流水
③ 如果DB扣减失败 → 重试 or 补偿（Redis回补）
```

## 六、高并发性能优化

```
① Redis预扣库存：把热点库存从DB移到Redis
② 本地缓存 + 异步同步：优惠券模板信息放本地缓存（Caffeine）
③ 令牌限流：令牌桶控制并发进入扣减逻辑的线程数
④ 库存分片：大库存拆成多个子库存，扣减时随机选一个，减少竞争
⑤ 异步核销：下单时只扣Redis，支付成功后异步核销DB
```

## 七、面试回答模板

> "优惠券系统核心是**规则引擎 + 库存防超卖 + 叠加互斥**。
>
> 规则引擎用策略模式，每种券类型一个Strategy实现，通过配置管理规则。叠加规则用叠加组和互斥组控制，同一互斥组只能选一张，叠加组内的券按优先级依次计算。
>
> 库存防超卖用Redis Lua脚本保证原子性，DB用MQ做最终一致。Lua预扣成功后发MQ，消费端落库，失败可重试。
>
> 高并发靠Redis预扣+令牌限流+库存分片，把热点从DB移到Redis，再用限流保护下游。"

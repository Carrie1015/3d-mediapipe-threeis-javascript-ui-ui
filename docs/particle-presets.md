# Particle Motion Presets

这个文件用来记录调参面板里比较满意的粒子运动参数组合。后续如果要把某一组设成默认值，可以把对应对象复制到 `src/config.js` 的 `DEFAULT_MOTION_PARAMS`。

## Preset 01 - 短促低拖尾扩散

记录来源：调参面板截图

| 分组 | 面板参数 | 代码 key | 数值 |
| --- | --- | --- | --- |
| Motion | 旋转 | `autoRotateSpeed` | `0.0009` |
| Motion | 点大小 | `pointSize` | `5.2` |
| Motion | 微动 | `motionNoise` | `1` |
| Dissolve | 纵向延迟 | `verticalDelay` | `1.75` |
| Dissolve | 扩散时长 | `scatterDuration` | `0.45` |
| Dissolve | 扩散强度 | `flowStrength` | `1` |
| Dissolve | 拖尾长度 | `flowLimit` | `0.2` |
| Dissolve | 丝线密度 | `filamentDensity` | `0.1` |
| Return | 回流开始 | `returnStart` | `3.85` |
| Return | 回流时长 | `returnDuration` | `1.9` |

```js
{
  pointSize: 5.2,
  autoRotateSpeed: 0.0009,
  verticalDelay: 1.75,
  scatterDuration: 0.45,
  returnStart: 3.85,
  returnDuration: 1.9,
  flowStrength: 1,
  flowLimit: 0.2,
  filamentDensity: 0.1,
  motionNoise: 1,
}
```

## Preset 02 - 高密度强扩散

记录来源：调参面板截图

当前默认参数。

| 分组 | 面板参数 | 代码 key | 数值 |
| --- | --- | --- | --- |
| Motion | 旋转 | `autoRotateSpeed` | `0.0053` |
| Motion | 点大小 | `pointSize` | `7.2` |
| Motion | 微动 | `motionNoise` | `2.05` |
| Dissolve | 纵向延迟 | `verticalDelay` | `1.5` |
| Dissolve | 扩散时长 | `scatterDuration` | `0.45` |
| Dissolve | 扩散强度 | `flowStrength` | `2.4` |
| Dissolve | 拖尾长度 | `flowLimit` | `0.55` |
| Dissolve | 丝线密度 | `filamentDensity` | `4` |
| Return | 回流开始 | `returnStart` | `3.85` |
| Return | 回流时长 | `returnDuration` | `0.95` |

```js
{
  pointSize: 7.2,
  autoRotateSpeed: 0.0053,
  verticalDelay: 1.5,
  scatterDuration: 0.45,
  returnStart: 3.85,
  returnDuration: 0.95,
  flowStrength: 2.4,
  flowLimit: 0.55,
  filamentDensity: 4,
  motionNoise: 2.05,
}
```

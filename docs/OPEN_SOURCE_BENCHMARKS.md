# 开源项目深度对标：数字孪生健康平台

> 对标日期：2026-10-19。健康数据属于高敏感信息。以下借鉴重点是记录结构、来源追溯和安全边界，不把演示页面包装成临床产品。

## 1. 上游项目与可借鉴点

### OpenMRS — 患者记录与观察值模型
- 仓库：[openmrs/openmrs-core](https://github.com/openmrs/openmrs-core)
- 关键实体：[Obs.java](https://github.com/openmrs/openmrs-core/blob/master/api/src/main/java/org/openmrs/Obs.java)、[Encounter.java](https://github.com/openmrs/openmrs-core/blob/master/api/src/main/java/org/openmrs/Encounter.java)。
- 借鉴：单条观察值不仅是数值，还应关联测量时间、指标概念、记录上下文、来源/地点和记录状态；一次记录或会话可以组织多条观察；更正历史记录时应保留前序版本和更正原因，而非静默覆盖。
- 不照搬：OpenMRS 面向医疗机构、患者、就诊和医护流程。本项目是本地浏览器个人健康数据演示空间，没有医院身份、处方或临床工作流，不能暗示具备 OpenMRS 的安全和合规能力。

### GNU Health / MyGNUHealth 与个人健康数据方向
- GNU Health 项目入口：[GNU Health](https://github.com/gnuhealth)
- 借鉴方向：个人健康记录应由用户控制，数据可导出、迁移和审阅；数据呈现要区分自我记录、设备采集和临床来源。
- 当前页面未连接医疗设备，也未接入经验证的临床评估模型，因此示例指标、演示评分和风险提示必须继续显著标识。

## 2. 对本项目的产品映射

| 模块 | 建议的数据/交互模式 | 验收点 |
|---|---|---|
| 健康总览 | 指标卡 + 最近测量时间 + 来源标识 | 示例、手动录入、设备导入不可混淆 |
| 健康记录 | 指标、数值、单位、时间、来源、备注 | 时间与单位校验；重复记录有解释 |
| 趋势分析 | 单指标时间序列 | 缺失值不补成真实测量；样本数与时间范围可见 |
| 器官/循环图谱 | 教育性示意与可交互浏览 | 不推断诊断、不生成真实风险分级 |
| 健康报告 | 用户可审阅的数据摘要 | 报告标注数据覆盖范围和非临床性质 |
| 数据管理 | 导出、导入、恢复和隐私提示 | 原始备份不被失败导入覆盖 |

## 3. 本轮实际落地
- 首页快捷入口连接到健康数据录入、报告和器官图谱。
- 首页评分标签改为“DEMO INDEX”，避免把演示数值误读为真实健康评分。
- 继续把“未连接设备”“示例指标”“非临床评估”作为首页明显信息，而不是隐藏在页脚。

## 4. 后续重构要求
1. 将每条观察记录视为不可随意覆写的事实事件；更正应保留前值、原因和修改时间。
2. 区分 observedAt（测量发生时间）与 recordedAt（录入时间）。
3. 指标定义需有单位、参考来源和适用人群；不同单位的值不可直接绘制到同一量纲。
4. 不提供自动诊断、治疗建议或未经验证的“健康分”。
5. 在增加云端同步前，先定义加密、身份验证、访问控制、导出和删除策略。

## 5. 参考链接
- [OpenMRS 核心仓库](https://github.com/openmrs/openmrs-core)
- [OpenMRS Obs 观察值模型](https://github.com/openmrs/openmrs-core/blob/master/api/src/main/java/org/openmrs/Obs.java)
- [OpenMRS Encounter 记录上下文](https://github.com/openmrs/openmrs-core/blob/master/api/src/main/java/org/openmrs/Encounter.java)
- [GNU Health](https://github.com/gnuhealth)

## 6. 2026-10-19 实施补充：测量时间与录入时间分离

- `src/domain/index.js` 的 `createObservation` 现在可选接受 `recordedAt`，与必需的 `observedAt` 分开校验并规范化为 UTC ISO 时间。
- `assets/js/legacy-app.js` 新建测量时记录实际录入时间，记录列表分别显示“测量时间”和“录入时间”。
- 旧备份中没有 `recordedAt` 的历史记录继续合法读取；系统不会伪造历史录入时间。重复记录身份仍依据指标、数值、单位、测量时间和来源，不因重新导入时间不同而误判为新测量。
- 回归测试覆盖旧记录兼容、时区归一化、无时区时间和无效日历日期。

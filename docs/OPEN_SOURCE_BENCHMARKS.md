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


## 7. 扩展开源对标：FHIR 数据平台与个人健康记录

> 覆盖说明：本节选取临床记录平台和 FHIR 开发平台作为数据模型参照；不表示当前单机演示页面已经获得这些项目的身份认证、服务器、合规或医疗能力。

| 上游项目 | 可核查入口 | 可迁移产品/工程模式 | 对本项目的边界 |
|---|---|---|---|
| [OpenMRS](https://github.com/openmrs/openmrs-core) | [Obs.java](https://github.com/openmrs/openmrs-core/blob/master/api/src/main/java/org/openmrs/Obs.java)、[Encounter.java](https://github.com/openmrs/openmrs-core/blob/master/api/src/main/java/org/openmrs/Encounter.java) | 观察值结构化、测量与就诊上下文、值和概念分离、记录生命周期 | 不模拟医院病人主索引、医嘱、权限体系或临床流程 |
| [Medplum](https://github.com/medplum/medplum) | [README 与架构组成](https://github.com/medplum/medplum/blob/main/README.md) | FHIR API/CDR、身份和权限边界、客户端 SDK 与 UI 组件分层；用于设计将来导入/同步接口 | 这是带服务端、FHIR、认证和权限的平台；当前 localStorage 不能宣称等价安全或互操作能力 |
| [GNU Health](https://www.gnu.org/software/health/) | [项目主页](https://www.gnu.org/software/health/) | 个人健康/医疗数据的开放标准、模块化与用户数据控制理念 | 医疗信息系统部署和治理模式不直接适用于个人浏览器演示 |

### 对本项目的实现映射
- 观察值按“指标概念、值、单位、测量时间、录入时间、来源质量、备注”展示，并保留老记录兼容。
- 首页流程按“记录 → 审阅报告 → 人体/器官教育图谱”排列；已移除没有真实依据的固定综合健康分。
- 下一阶段把记录更正设计为带前值、原因和更正时间的版本链；未完成前不静默覆盖既有测量。
- 若未来引入 FHIR 导入，先做 Observation/CodeableConcept/Quantity/Provenance 映射和数据质量提示；JSON 上传不等于 FHIR 互操作。


## 8. 2026-10-19 源码级复核：OpenMRS Obs 更正与版本关系

本轮实际读取 OpenMRS 的 `api/src/main/java/org/openmrs/Obs.java` 和 `api/src/test/java/org/openmrs/ObsTest.java`，不只参考 README：

- [`Obs.java`](https://github.com/openmrs/openmrs-core/blob/master/api/src/main/java/org/openmrs/Obs.java) 将 Observation 定义为单条临床信息，并支持父子分组、Encounter/Location 等上下文、数值/文本/编码/日期等值类型，以及 `PRELIMINARY`、`FINAL`、`AMENDED` 状态。
- 该源码的类文档明确建议：已进入正式就诊记录的观察值需要更正时，创建新 Obs，使用 `setPreviousVersion(oldObs)` 关联旧版本，并以说明原因的方式保存新记录，再对旧记录执行带原因的 void 操作；不是直接覆盖旧值。
- [`ObsTest.java`](https://github.com/openmrs/openmrs-core/blob/master/api/src/test/java/org/openmrs/ObsTest.java) 覆盖 Obs 分组成员添加/删除、重复成员处理、层级关联观察和不同日期时间格式等行为。测试重点不只是展示数值，也包括实体关系行为。

### 对 Health Twin 的映射与当前边界

- 当前 Health Twin 的 `createObservation` 已区分测量时间 `observedAt`、录入时间 `recordedAt`、来源 `source` 和质量分类 `quality`；`observationIdentity` 以规范化后的测量事实识别重复记录。
- 当前导入采用追加合并并跳过完全重复记录，单条记录没有原地编辑入口；因此当前实现不会静默改写已有测量，但也尚未提供正式的“更正版本链”、更正原因、前序记录引用或作废状态。
- 下一阶段建议新增显式更正事件：为每条观察记录分配稳定 ID；更正创建新记录并引用 `previousVersionId`，要求更正原因、操作者标识和更正时间；旧记录保留并标记为已被更正，不从原始历史中删除。趋势图和摘要默认只纳入当前有效版本，同时允许查看完整历史。
- 本地浏览器数据无法提供 OpenMRS 的服务端身份、审计不可抵赖性或临床治理。未实现这些能力前，不显示“已审核”“临床确认”或“不可篡改”等状态。

import { db } from "@/lib/db";
import UploadForm from "@/components/UploadForm";
import { getT } from "@/lib/i18n-server";

export default async function ImportPage() {
  const t = await getT();
  const orgs = db.prepare("SELECT id, name FROM orgs ORDER BY name").all() as { id: number; name: string }[];
  return (
    <>
      <h1>{t("批量导入账号")}</h1>
      <div className="card">
        <h2>{t("1. 下载模板")}</h2>
        <p className="small muted">
          {t("表头：用户名 | 姓名 | 角色 | 密码 | 学校。角色填「学生」或「教师」（新账号不填默认学生，已有账号不填则保持原角色）；密码不填默认 123456；学校不存在会自动创建。学生与教师的绑定由教师在自己的后台完成。已存在的用户名会更新姓名/学校（填了密码才会改密码）。")}
        </p>
        <a className="btn btn-ghost" href="/api/templates/users">{t("下载 Excel 模板")}</a>
      </div>
      <div className="card">
        <h2>{t("2. 上传 Excel")}</h2>
        <UploadForm endpoint="/api/admin/import-users" accept=".xlsx,.xls,.csv">
          <div className="field" style={{ maxWidth: 320 }}>
            <label>{t("表格中未填学校时，默认归属")}</label>
            <select name="org_id">
              <option value="">{t("（不设置）")}</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        </UploadForm>
      </div>
    </>
  );
}

import { db } from "@/lib/db";
import UploadForm from "@/components/UploadForm";

export default function ImportPage() {
  const orgs = db.prepare("SELECT id, name FROM orgs ORDER BY name").all() as { id: number; name: string }[];
  return (
    <>
      <h1>批量导入账号</h1>
      <div className="card">
        <h2>1. 下载模板</h2>
        <p className="small muted">
          表头：<b>用户名 | 姓名 | 角色 | 密码 | 学校</b>。角色填「学生」或「教师」（不填默认学生）；
          密码不填默认 123456；学校不存在会自动创建。学生与教师的绑定由教师在自己的后台完成。
          已存在的用户名会更新姓名/学校（填了密码才会改密码）。
        </p>
        <a className="btn btn-ghost" href="/api/templates/users">下载 Excel 模板</a>
      </div>
      <div className="card">
        <h2>2. 上传 Excel</h2>
        <UploadForm endpoint="/api/admin/import-users" accept=".xlsx,.xls,.csv">
          <div className="field" style={{ maxWidth: 320 }}>
            <label>表格中未填学校时，默认归属</label>
            <select name="org_id">
              <option value="">（不设置）</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        </UploadForm>
      </div>
    </>
  );
}

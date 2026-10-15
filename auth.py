"""
auth.py — 临时测试账号登录验证

⚠️ 临时演示用：密码均为 123456，不得用于正式部署或真实业务数据。

四个测试账号：
  A1 → 普通员工（employee）
  A2 → 人事专员（hr）
  A3 → 财务人员（finance）
  A4 → 内部审计人员（auditor）
"""

from typing import Optional, Dict, Any


# ── 测试账号表 ──
# 账号 → {password, name, role, role_label, department}
TEST_ACCOUNTS: Dict[str, Dict[str, Any]] = {
    "A1": {
        "password": "123456",
        "name": "陈杰",
        "role": "employee",
        "role_label": "普通员工",
        "department": "销售部",
        "employee_id": "E004",
    },
    "A2": {
        "password": "123456",
        "name": "张明",
        "role": "hr",
        "role_label": "人事专员",
        "department": "人事部",
        "employee_id": "E001",
    },
    "A3": {
        "password": "123456",
        "name": "李华",
        "role": "finance",
        "role_label": "财务人员",
        "department": "财务部",
        "employee_id": "E002",
    },
    "A4": {
        "password": "123456",
        "name": "王敏",
        "role": "auditor",
        "role_label": "内部审计人员",
        "department": "审计部",
        "employee_id": "E003",
    },
}

# 统一测试密码
TEST_PASSWORD = "123456"


def verify_login(account: str, password: str) -> Optional[Dict[str, Any]]:
    """
    验证登录账号和密码。

    Args:
        account:  账号（如 A1、A2、A3、A4）
        password: 密码

    Returns:
        验证成功 → 返回用户信息字典（含 name/role/role_label/department/employee_id）
        验证失败 → 返回 None
    """
    if not account or not password:
        return None

    user = TEST_ACCOUNTS.get(account)
    if user is None:
        return None

    if user["password"] != password:
        return None

    # 返回用户信息（不包含密码）
    return {
        "account": account,
        "name": user["name"],
        "role": user["role"],
        "role_label": user["role_label"],
        "department": user["department"],
        "employee_id": user["employee_id"],
    }


def get_user_info(account: str) -> Optional[Dict[str, Any]]:
    """根据账号获取用户信息（不含密码），用于 session 恢复。"""
    user = TEST_ACCOUNTS.get(account)
    if user is None:
        return None
    return {
        "account": account,
        "name": user["name"],
        "role": user["role"],
        "role_label": user["role_label"],
        "department": user["department"],
        "employee_id": user["employee_id"],
    }

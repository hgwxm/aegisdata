"""
test_auth.py — 登录功能测试

测试内容：
  1. 正确账号 + 正确密码 → 登录成功
  2. 正确账号 + 错误密码 → 登录失败
  3. 不存在的账号 → 登录失败
  4. 空账号 / 空密码 → 登录失败
  5. 登录后 session 正确设置角色
  6. 未登录访问受保护页面 → 重定向到 /login
  7. 未登录访问 API → 返回 401
  8. 登录后访问 /api/me → 返回用户信息
  9. 登出后 session 清除
 10. /api/access 角色由 session 决定，不接受前端传入

运行方式：
  python test_auth.py
  或
  python -m pytest test_auth.py -v
"""

import os
import sys
import json

# 确保能导入项目模块
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from app import app
from auth import verify_login, TEST_ACCOUNTS, TEST_PASSWORD


def test_correct_login():
    """测试 1：正确账号 + 正确密码 → 登录成功"""
    for account in ["A1", "A2", "A3", "A4"]:
        user = verify_login(account, TEST_PASSWORD)
        assert user is not None, f"{account} 登录应成功"
        assert user["account"] == account
        assert "role" in user
        assert "role_label" in user
        assert "name" in user
        print(f"  ✓ {account} ({user['role_label']}) 登录成功")


def test_wrong_password():
    """测试 2：正确账号 + 错误密码 → 登录失败"""
    for account in ["A1", "A2", "A3", "A4"]:
        user = verify_login(account, "wrong_password")
        assert user is None, f"{account} 用错误密码应登录失败"
        print(f"  ✓ {account} 错误密码被拒绝")


def test_nonexistent_account():
    """测试 3：不存在的账号 → 登录失败"""
    for account in ["X1", "admin", "B5", "a1", ""]:
        user = verify_login(account, TEST_PASSWORD)
        assert user is None, f"账号 '{account}' 不存在，应登录失败"
        print(f"  ✓ 账号 '{account}' 不存在，登录被拒绝")


def test_empty_credentials():
    """测试 4：空账号 / 空密码 → 登录失败"""
    assert verify_login("", "123456") is None, "空账号应失败"
    assert verify_login("A1", "") is None, "空密码应失败"
    assert verify_login("", "") is None, "空账号空密码应失败"
    print("  ✓ 空账号/空密码均被拒绝")


def test_role_mapping():
    """测试 5：四个账号角色映射正确"""
    expected = {
        "A1": ("employee", "普通员工"),
        "A2": ("hr", "人事专员"),
        "A3": ("finance", "财务人员"),
        "A4": ("auditor", "内部审计人员"),
    }
    for account, (role, label) in expected.items():
        user = verify_login(account, TEST_PASSWORD)
        assert user["role"] == role, f"{account} 角色应为 {role}"
        assert user["role_label"] == label, f"{account} 角色标签应为 {label}"
        print(f"  ✓ {account} → {role} ({label})")


def test_api_login_success():
    """测试 6：POST /api/login 正确账号密码 → 200 + ok:true"""
    client = app.test_client()
    resp = client.post("/api/login",
                       data=json.dumps({"account": "A1", "password": "123456"}),
                       content_type="application/json")
    assert resp.status_code == 200, f"应返回 200，实际 {resp.status_code}"
    data = resp.get_json()
    assert data["ok"] is True
    assert data["user"]["account"] == "A1"
    assert data["user"]["role"] == "employee"
    print("  ✓ /api/login A1 登录成功，返回用户信息")


def test_api_login_wrong_password():
    """测试 7：POST /api/login 错误密码 → 401 + ok:false"""
    client = app.test_client()
    resp = client.post("/api/login",
                       data=json.dumps({"account": "A1", "password": "999999"}),
                       content_type="application/json")
    assert resp.status_code == 401, f"应返回 401，实际 {resp.status_code}"
    data = resp.get_json()
    assert data["ok"] is False
    assert "账号或密码错误" in data["error"]
    print("  ✓ /api/login 错误密码返回 401 + 错误提示")


def test_api_login_nonexistent():
    """测试 8：POST /api/login 不存在账号 → 401"""
    client = app.test_client()
    resp = client.post("/api/login",
                       data=json.dumps({"account": "X9", "password": "123456"}),
                       content_type="application/json")
    assert resp.status_code == 401
    data = resp.get_json()
    assert data["ok"] is False
    print("  ✓ /api/login 不存在账号返回 401")


def test_protected_page_redirect():
    """测试 9：未登录访问受保护页面 → 302 重定向到 /login"""
    client = app.test_client()
    for path in ["/", "/audit", "/rules", "/about"]:
        resp = client.get(path)
        assert resp.status_code == 302, f"{path} 未登录应重定向，实际 {resp.status_code}"
        assert "/login" in resp.headers.get("Location", ""), f"{path} 应重定向到 /login"
        print(f"  ✓ 未登录访问 {path} → 重定向到 /login")


def test_protected_api_401():
    """测试 10：未登录访问受保护 API → 401"""
    client = app.test_client()
    for path in ["/api/me", "/api/files", "/api/audit/logs", "/api/audit/stats"]:
        resp = client.get(path)
        assert resp.status_code == 401, f"{path} 未登录应返回 401，实际 {resp.status_code}"
        print(f"  ✓ 未登录访问 {path} → 401")


def test_login_then_access():
    """测试 11：登录后可以访问受保护页面和 API"""
    client = app.test_client()
    # 先登录
    resp = client.post("/api/login",
                       data=json.dumps({"account": "A3", "password": "123456"}),
                       content_type="application/json")
    assert resp.status_code == 200
    # 访问控制台
    resp = client.get("/")
    assert resp.status_code == 200, f"登录后访问 / 应返回 200，实际 {resp.status_code}"
    # 访问 /api/me
    resp = client.get("/api/me")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["user"]["account"] == "A3"
    assert data["user"]["role"] == "finance"
    print("  ✓ A3 登录后可访问 / 和 /api/me，角色为 finance")


def test_access_uses_session_role():
    """测试 12：/api/access 角色由 session 决定，忽略前端传入的 user_role"""
    client = app.test_client()
    # 以 A1 (employee) 登录
    client.post("/api/login",
                data=json.dumps({"account": "A1", "password": "123456"}),
                content_type="application/json")
    # 尝试传入 admin 角色（应被忽略，实际用 employee）
    resp = client.post("/api/access",
                       data=json.dumps({"user_role": "admin", "file_id": "F003", "action": "read"}),
                       content_type="application/json")
    assert resp.status_code == 200
    data = resp.get_json()
    # employee 对 F003 read 应该是 DENY，如果是 ALLOW 说明用了 admin 角色（错误）
    assert data["decision"] == "DENY", \
        f"A1(employee) 访问 F003 应 DENY，实际 {data['decision']}（可能误用了前端传入的 admin 角色）"
    print("  ✓ /api/access 忽略前端 user_role，使用 session 中的 employee 角色")


def test_logout_clears_session():
    """测试 13：登出后 session 清除，再访问受保护页面重定向"""
    client = app.test_client()
    # 登录
    client.post("/api/login",
                data=json.dumps({"account": "A2", "password": "123456"}),
                content_type="application/json")
    # 确认已登录
    resp = client.get("/api/me")
    assert resp.status_code == 200
    # 登出
    resp = client.post("/api/logout")
    assert resp.status_code == 200
    # 再访问 /api/me 应 401
    resp = client.get("/api/me")
    assert resp.status_code == 401, f"登出后 /api/me 应 401，实际 {resp.status_code}"
    # 访问 / 应重定向
    resp = client.get("/")
    assert resp.status_code == 302
    print("  ✓ 登出后 session 清除，受保护资源不可访问")


def test_login_page_accessible():
    """测试 14：未登录可以访问 /login 页面"""
    client = app.test_client()
    resp = client.get("/login")
    assert resp.status_code == 200, f"/login 应返回 200，实际 {resp.status_code}"
    print("  ✓ /login 页面未登录可访问")


def test_health_no_auth_required():
    """测试 15：/api/health 不需要登录"""
    client = app.test_client()
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "ok"
    print("  ✓ /api/health 无需登录即可访问")


# ── 测试运行器 ──

ALL_TESTS = [
    test_correct_login,
    test_wrong_password,
    test_nonexistent_account,
    test_empty_credentials,
    test_role_mapping,
    test_api_login_success,
    test_api_login_wrong_password,
    test_api_login_nonexistent,
    test_protected_page_redirect,
    test_protected_api_401,
    test_login_then_access,
    test_access_uses_session_role,
    test_logout_clears_session,
    test_login_page_accessible,
    test_health_no_auth_required,
]


def run_all():
    """运行所有测试并输出结果。"""
    print("=" * 60)
    print("AegisData 登录功能测试")
    print("=" * 60)
    passed = 0
    failed = 0
    for test in ALL_TESTS:
        print(f"\n▶ {test.__doc__}")
        try:
            test()
            passed += 1
        except AssertionError as e:
            failed += 1
            print(f"  ✗ 失败：{e}")
        except Exception as e:
            failed += 1
            print(f"  ✗ 异常：{e}")

    print("\n" + "=" * 60)
    print(f"结果：{passed} 通过 / {failed} 失败 / 共 {len(ALL_TESTS)} 项")
    print("=" * 60)
    return failed == 0


if __name__ == "__main__":
    success = run_all()
    sys.exit(0 if success else 1)

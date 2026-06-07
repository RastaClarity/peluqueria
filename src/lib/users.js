const ROLES = {
  ADMIN: "admin",
  STAFF: "staff",
  CLIENT: "client",
};

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();

  if (["admin", "administrador", "administrator"].includes(role)) {
    return ROLES.ADMIN;
  }

  if (["staff", "empleado", "trabajador", "worker"].includes(role)) {
    return ROLES.STAFF;
  }

  return ROLES.CLIENT;
}

function isAdminUser(user) {
  return normalizeRole(user?.rol || user?.role) === ROLES.ADMIN;
}

function isStaffUser(user) {
  return normalizeRole(user?.rol || user?.role) === ROLES.STAFF;
}

function isInternalUser(user) {
  const r = normalizeRole(user?.rol || user?.role);
  return r === ROLES.ADMIN || r === ROLES.STAFF;
}

function normalizeText(text = "") {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export {
  ROLES,
  normalizeRole,
  isAdminUser,
  isStaffUser,
  isInternalUser,
  normalizeText
};

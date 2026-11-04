import { query, queryOne } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { encrypt } from '../../utils/crypto.js';

const toDto = (row) => ({
  fullName: row.full_name,
  panMasked: `XXXXXX${row.pan_last4}`,
  dob: row.dob,
  residentialStatus: row.residential_status,
  occupation: row.occupation,
  address: row.address || '',
});

export const getProfile = async (userId) => {
  const row = await queryOne('SELECT * FROM taxpayer_profiles WHERE user_id = :userId', { userId });
  return row ? toDto(row) : null;
};

export const saveProfile = async (userId, input) => {
  const existing = await queryOne('SELECT id FROM taxpayer_profiles WHERE user_id = :userId', { userId });
  if (!existing && !input.pan) throw AppError.badRequest('PAN is required', 'VALIDATION_ERROR', [{ field: 'pan', message: 'PAN is required' }]);

  const params = {
    userId,
    fullName: input.fullName,
    dob: input.dob,
    status: input.residentialStatus,
    occupation: input.occupation,
    address: input.address || null,
  };

  if (!existing) {
    await query(
      `INSERT INTO taxpayer_profiles (user_id, pan_encrypted, pan_last4, full_name, dob, residential_status, occupation, address)
       VALUES (:userId, :pan, :last4, :fullName, :dob, :status, :occupation, :address)`,
      { ...params, pan: encrypt(input.pan), last4: input.pan.slice(-4) },
    );
  } else {
    await query(
      `UPDATE taxpayer_profiles
          SET full_name = :fullName, dob = :dob, residential_status = :status, occupation = :occupation, address = :address
              ${input.pan ? ', pan_encrypted = :pan, pan_last4 = :last4' : ''}
        WHERE user_id = :userId`,
      input.pan ? { ...params, pan: encrypt(input.pan), last4: input.pan.slice(-4) } : params,
    );
  }
  return getProfile(userId);
};

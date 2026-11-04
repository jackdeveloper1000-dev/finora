import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountApi } from '../../api/services';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/errors';
import { downloadBlob } from '../../utils/format';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Card from '../ui/Card';
import ConfirmPasswordModal from './ConfirmPasswordModal';

export default function PrivacyCard() {
  const navigate = useNavigate();
  const { endSession } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // 'clear' | 'delete'

  const download = async () => {
    setExporting(true);
    setError('');
    try {
      const { blob, name } = await accountApi.exportData();
      downloadBlob(blob, name);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Card title="Your data" subtitle="You are in control of what Finora holds about you.">
        <div className="form">
          <Alert tone="info" title="Encrypted at rest">Uploaded files and your PAN are protected with AES-256 encryption, and only you can open them.</Alert>
          <Alert tone="danger">{error}</Alert>
          <div className="privacy-row">
            <div>
              <strong>Download my data</strong>
              <p className="muted">A JSON file with your profile, returns, transactions, calculations and activity. Uploaded files themselves are not included.</p>
            </div>
            <Button variant="secondary" loading={exporting} onClick={download}><Download size={16} />Download</Button>
          </div>
        </div>
      </Card>

      <Card title="Danger zone" className="danger-zone">
        <div className="form">
          <div className="privacy-row">
            <div>
              <strong>Clear all my returns</strong>
              <p className="muted">Permanently deletes every return, uploaded document and calculation. Your account and taxpayer details stay.</p>
            </div>
            <Button variant="danger" onClick={() => setModal('clear')}><Trash2 size={16} />Clear data</Button>
          </div>
          <div className="privacy-row">
            <div>
              <strong>Delete my account</strong>
              <p className="muted">Permanently deletes your account and everything in it. This cannot be undone.</p>
            </div>
            <Button variant="danger" onClick={() => setModal('delete')}>Delete account</Button>
          </div>
        </div>
      </Card>

      {modal === 'clear' && (
        <ConfirmPasswordModal
          title="Clear all my returns"
          description="Every return, document and calculation will be permanently deleted. This cannot be undone."
          actionLabel="Delete everything"
          onClose={() => setModal(null)}
          onConfirm={async (password) => {
            await accountApi.clearData(password);
            setModal(null);
            navigate('/dashboard');
          }}
        />
      )}
      {modal === 'delete' && (
        <ConfirmPasswordModal
          title="Delete my account"
          description="Your account, returns and uploaded documents will be permanently deleted, and you will be signed out."
          actionLabel="Delete my account"
          confirmWord="DELETE"
          onClose={() => setModal(null)}
          onConfirm={async (password) => {
            await accountApi.deleteAccount(password);
            endSession();
            // A full reload leaves nothing of the deleted account in memory and lands on the public page.
            window.location.assign('/');
          }}
        />
      )}
    </>
  );
}

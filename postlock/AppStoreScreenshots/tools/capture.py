import os, subprocess, time
from pathlib import Path
root = Path(__file__).resolve().parents[1]
device = '66F95F24-5635-4658-9BBA-AD5599EA42F3'
bundle = 'com.swiply.postlock.capture'
for scenario, name in [('hero','01-hero'),('plan','02-plan'),('blocking','03-blocking'),('progress','04-progress'),('profile','05-profile'),('complete','06-complete')]:
    subprocess.run(['xcrun','simctl','terminate',device,bundle],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    env = dict(os.environ, SIMCTL_CHILD_POSTLOCK_CAPTURE=scenario)
    subprocess.run(['xcrun','simctl','launch',device,bundle],env=env,check=True)
    time.sleep(3)
    subprocess.run(['xcrun','simctl','io',device,'screenshot',str(root/'source'/f'{name}.png')],check=True)

# -*- mode: ruby -*-
# vi: set ft=ruby :

# Boostrap Script
$script = <<SCRIPT

# Update & Install
echo 'Updating and installing ubuntu packages...'
apt-get update
apt-get install -y build-essential git curl imagemagick

# NodeJS via NVM
echo "Installing Node Version Manager..."
export HOME=/home/vagrant
curl https://raw.githubusercontent.com/creationix/nvm/v0.7.0/install.sh | sh
echo "source ~/.nvm/nvm.sh" >> /home/vagrant/.bashrc
source /home/vagrant/.nvm/nvm.sh
#nvm install 0.8
nvm install 0.10
#nvm install 0.11
export HOME=/home/root

# NPM package install
echo "Installing NPM packages..."
echo "PATH=$PATH:/vagrant/node_modules/.bin" >> /home/vagrant/.bashrc
PATH=$PATH:/vagrant/node_modules/.bin
cd /vagrant/ && rm -rf node_modules
[ -f package.json ] && npm install

# Read secret environment variables
AWS_ACCESS_KEY_ID=`cat ./env/AWS_ACCESS_KEY_ID`
AWS_SECRET_ACCESS_KEY=`cat ./env/AWS_SECRET_ACCESS_KEY`

# Vagratnt Environment Varaibles
echo "Setting environment variables..."
echo "export NODE_ENV=development"                          >> /home/vagrant/.bashrc
echo "export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID"          >> /home/vagrant/.bashrc
echo "export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY"  >> /home/vagrant/.bashrc
echo "\ncd /vagrant"                                        >> /home/vagrant/.bashrc

chown vagrant:vagrant /home/vagrant/.nvm
chown vagrant:vagrant /home/vagrant/tmp

SCRIPT

Vagrant.configure("2") do |config|
  # All Vagrant configuration is done here. The most common configuration
  # options are documented and commented below. For a complete reference,
  # please see the online documentation at vagrantup.com.

  # Every Vagrant virtual environment requires a box to build off of.
  config.vm.box = "precise32"

  # The url from where the 'config.vm.box' box will be fetched if it
  # doesn't already exist on the user's system.
  config.vm.box_url = "http://files.vagrantup.com/precise32.box"

  # Create a forwarded port mapping which allows access to a specific port
  # within the machine from a port on the host machine. In the example below,
  # accessing "localhost:8080" will access port 80 on the guest machine.
  # config.vm.network :forwarded_port, guest: 8080, host: 3004

  # The shell provisioner allows you to upload and execute a script as the root
  # user within the guest machine.
  config.vm.provision :shell, :inline => $script

  # Create a private network, which allows host-only access to the machine
  # using a specific IP.
  # config.vm.network :private_network, ip: "192.168.33.10"

  # Create a public network, which generally matched to bridged network.
  # Bridged networks make the machine appear as another physical device on
  # your network.
  # config.vm.network :public_network

  # Share an additional folder to the guest VM. The first argument is
  # the path on the host to the actual folder. The second argument is
  # the path on the guest to mount the folder. And the optional third
  # argument is a set of non-required options.
  # config.vm.synced_folder "../data", "/vagrant_data"

  # Provider-specific configuration so you can fine-tune various
  # backing providers for Vagrant. These expose provider-specific options.
  # Example for VirtualBox:

  config.vm.provider :virtualbox do |vb|
    vb.customize ["modifyvm", :id, "--memory", "256"]
  end

end

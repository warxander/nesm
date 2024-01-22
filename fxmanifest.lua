fx_version 'cerulean'
game 'gta5'

dependencies {
	'yarn',
	'webpack'
}

files {
	'src/nui/index.html',
	'src/nui/index.js'
}

client_script 'dist/nesm.js'

ui_page 'src/nui/index.html'

webpack_config 'webpack.config.js'

txd_name 'nesm'
txn_name 'frame'
target_fps '60'
show_controls 'true'
